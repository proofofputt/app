#!/usr/bin/env node

/**
 * Golf Course CSV Import Script
 * ============================================================================
 * Imports ~11,600 US golf courses from OpenStreetMap CSV files into the
 * clubs table for the Club Representative system.
 *
 * Data Sources:
 * - courses.no.data - courses.nowebsite.nophone.csv (5,865 courses)
 * - Courses.Website.Available - Website.Full.csv (5,751 courses)
 *
 * Features:
 * - Merges both CSV files (website data takes priority)
 * - Deduplicates by name + location
 * - Generates URL-friendly slugs
 * - Batch inserts (100 at a time)
 * - Error handling and progress tracking
 * - Detailed import summary
 *
 * Usage:
 * node scripts/import-golf-courses.js
 * ============================================================================
 */

import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// CSV file paths
const CSV_FILES = [
  {
    path: '/Users/nw/proofofputt-repos/proofofputt/GCmcp/GCdb/Courses.Website.Available - Website.Full.csv',
    hasContactData: true,
    priority: 1, // Process first (better data)
  },
  {
    path: '/Users/nw/proofofputt-repos/proofofputt/GCmcp/GCdb/courses.no.data - courses.nowebsite.nophone.csv',
    hasContactData: false,
    priority: 2, // Process second (fallback data)
  },
];

// Import statistics
const stats = {
  totalProcessed: 0,
  imported: 0,
  duplicates: 0,
  errors: 0,
  byState: {},
};

/**
 * Generate URL-friendly slug from club name and location
 */
function generateSlug(name, city, state) {
  let slug = name
    .toLowerCase()
    .replace(/golf course|golf club|country club|golf links|golf & country club/gi, '')
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Add city/state if available for uniqueness
  if (city) {
    slug += `-${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }
  if (state) {
    slug += `-${state.toLowerCase()}`;
  }

  // Clean up again after adding location
  slug = slug
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 255); // Database limit

  return slug;
}

/**
 * Parse CSV file and return array of courses
 */
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const courses = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    fs.createReadStream(filePath)
      .pipe(parser)
      .on('data', (row) => {
        courses.push(row);
      })
      .on('end', () => {
        resolve(courses);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Create unique key for deduplication
 */
function createDedupeKey(course) {
  const name = (course.name || '').trim().toLowerCase();
  const city = (course.addr_city || '').trim().toLowerCase();
  const state = (course.addr_state || '').trim().toLowerCase();
  const postcode = (course.addr_postcode || '').trim().toLowerCase();

  return `${name}|${city}|${state}|${postcode}`;
}

/**
 * Merge course data (prefer courses with contact info)
 */
function mergeCourses(coursesMap) {
  const merged = [];

  for (const [key, courseData] of coursesMap.entries()) {
    // If multiple entries for same course, prefer one with contact data
    const bestCourse = courseData.sort((a, b) => {
      const aHasContact = !!(a.website || a.phone || a.email);
      const bHasContact = !!(b.website || b.phone || b.email);
      return bHasContact - aHasContact; // Sort descending
    })[0];

    merged.push(bestCourse);
  }

  return merged;
}

/**
 * Transform CSV row to database format
 */
function transformCourse(row) {
  const name = row.name || 'Unnamed Golf Course';
  const city = row.addr_city || null;
  const state = row.addr_state || null;
  const slug = generateSlug(name, city, state);

  return {
    name,
    slug,
    club_type: 'golf_course',
    address_street: row.addr_street || null,
    address_city: city,
    address_state: state,
    address_postcode: row.addr_postcode || null,
    address_country: row.addr_country || 'USA',
    full_address: row.full_address || null,
    latitude: row.lat ? parseFloat(row.lat) : null,
    longitude: row.lng ? parseFloat(row.lng) : null,
    phone: row.phone || null,
    email: row.email || null,
    website: row.website || null,
    osm_id: row.osm_id ? parseInt(row.osm_id) : null,
    osm_data: {
      feature_type: row.feature_type,
      osm_timestamp: row.osm_timestamp,
      geometry_geojson: row.geometry_geojson,
    },
    is_active: true,
    is_verified: false,
  };
}

/**
 * Insert courses in batches
 */
async function insertBatch(courses, batchSize = 100) {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (let i = 0; i < courses.length; i += batchSize) {
    const batch = courses.slice(i, i + batchSize);

    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(courses.length / batchSize)} (${batch.length} courses)...`);

    for (const course of batch) {
      try {
        // Check for existing slug
        const existingCheck = await pool.query(
          'SELECT club_id FROM clubs WHERE slug = $1 LIMIT 1',
          [course.slug]
        );

        if (existingCheck.rows.length > 0) {
          // Slug exists, append random suffix
          course.slug = `${course.slug}-${Math.random().toString(36).substring(2, 8)}`;
        }

        // Insert course
        await pool.query(
          `INSERT INTO clubs (
            name, slug, club_type,
            address_street, address_city, address_state, address_postcode, address_country,
            full_address, latitude, longitude,
            phone, email, website,
            osm_id, osm_data,
            is_active, is_verified
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14,
            $15, $16,
            $17, $18
          )`,
          [
            course.name,
            course.slug,
            course.club_type,
            course.address_street,
            course.address_city,
            course.address_state,
            course.address_postcode,
            course.address_country,
            course.full_address,
            course.latitude,
            course.longitude,
            course.phone,
            course.email,
            course.website,
            course.osm_id,
            JSON.stringify(course.osm_data),
            course.is_active,
            course.is_verified,
          ]
        );

        inserted++;

        // Track by state
        const state = course.address_state || 'Unknown';
        stats.byState[state] = (stats.byState[state] || 0) + 1;
      } catch (error) {
        if (error.code === '23505') {
          // Unique constraint violation (duplicate)
          duplicates++;
          stats.duplicates++;
        } else {
          console.error(`Error inserting ${course.name}:`, error.message);
          errors++;
          stats.errors++;
        }
      }
    }

    console.log(`  ✓ Inserted: ${inserted - (i > 0 ? stats.imported : 0)}, Duplicates: ${duplicates}, Errors: ${errors}`);
  }

  stats.imported = inserted;
  return { inserted, duplicates, errors };
}

/**
 * Main import function
 */
async function importGolfCourses() {
  console.log('🏌️  Golf Course Import Script');
  console.log('==========================================\n');

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected\n');

    // Load and parse CSV files
    console.log('📄 Loading CSV files...');
    const coursesMap = new Map();

    for (const csvFile of CSV_FILES) {
      console.log(`  Reading: ${path.basename(csvFile.path)}`);
      const courses = await parseCSV(csvFile.path);
      console.log(`  ✓ Loaded ${courses.length} courses`);

      // Add to map for deduplication
      for (const course of courses) {
        const key = createDedupeKey(course);

        if (!coursesMap.has(key)) {
          coursesMap.set(key, []);
        }

        coursesMap.get(key).push({
          ...course,
          priority: csvFile.priority,
        });
      }

      stats.totalProcessed += courses.length;
    }

    console.log(`\n📊 Total courses loaded: ${stats.totalProcessed}`);
    console.log(`📊 Unique courses (after deduplication): ${coursesMap.size}\n`);

    // Merge duplicates
    console.log('🔄 Merging duplicate entries...');
    const mergedCourses = mergeCourses(coursesMap);
    console.log(`✅ Merged to ${mergedCourses.length} courses\n`);

    // Transform to database format
    console.log('🔄 Transforming data...');
    const transformedCourses = mergedCourses.map(transformCourse);
    console.log(`✅ Transformed ${transformedCourses.length} courses\n`);

    // Insert into database
    console.log('💾 Inserting into database...');
    const result = await insertBatch(transformedCourses);

    // Print summary
    console.log('\n==========================================');
    console.log('✅ Import Complete!');
    console.log('==========================================');
    console.log(`Total Processed: ${stats.totalProcessed}`);
    console.log(`Successfully Imported: ${stats.imported}`);
    console.log(`Duplicates Skipped: ${stats.duplicates}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('\n📊 Courses by State:');

    // Sort states by count
    const sortedStates = Object.entries(stats.byState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 states

    sortedStates.forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`);
    });

    console.log('\n🎉 Golf courses are now available for Club Representative system!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run import
importGolfCourses().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
