/**
 * Admin Club Management API
 * ============================================================================
 * GET /api/admin/clubs - List all clubs with filtering
 * POST /api/admin/clubs - Create new club
 *
 * Admin only endpoint for club creation and management
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../../utils/cors.js';
import { verifyToken } from '../../../utils/auth.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  const user = await verifyToken(req);

  if (!user || !user.playerId) {
    return { authorized: false, message: 'Authentication required' };
  }

  const result = await pool.query(
    'SELECT player_id, is_admin FROM players WHERE player_id = $1 AND is_admin = TRUE',
    [user.playerId]
  );

  if (result.rows.length === 0) {
    return { authorized: false, message: 'Admin access required' };
  }

  return { authorized: true, playerId: user.playerId };
}

/**
 * Generate URL-friendly slug from club name
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

  if (city) {
    slug += `-${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }
  if (state) {
    slug += `-${state.toLowerCase()}`;
  }

  return slug
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 255);
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify admin access
  const adminCheck = await verifyAdmin(req);
  if (!adminCheck.authorized) {
    return res.status(403).json({
      success: false,
      message: adminCheck.message,
    });
  }

  // GET - List all clubs
  if (req.method === 'GET') {
    try {
      const {
        search = '',
        state = '',
        club_type = '',
        is_verified = '',
        limit = 50,
        offset = 0,
        sort_by = 'name',
        sort_order = 'asc',
      } = req.query;

      let query = `
        SELECT
          club_id,
          name,
          slug,
          club_type,
          address_city,
          address_state,
          website,
          phone,
          email,
          is_active,
          is_verified,
          subscription_bundle_balance,
          created_at,
          (SELECT COUNT(*) FROM club_representatives WHERE club_id = clubs.club_id AND is_active = TRUE) as rep_count,
          (SELECT COUNT(*) FROM player_club_affiliations WHERE club_id = clubs.club_id AND is_active = TRUE) as player_count
        FROM clubs
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      // Search filter
      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR address_city ILIKE $${paramCount} OR address_state ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // State filter
      if (state) {
        paramCount++;
        query += ` AND address_state = $${paramCount}`;
        params.push(state);
      }

      // Club type filter
      if (club_type) {
        paramCount++;
        query += ` AND club_type = $${paramCount}`;
        params.push(club_type);
      }

      // Verified filter
      if (is_verified !== '') {
        paramCount++;
        query += ` AND is_verified = $${paramCount}`;
        params.push(is_verified === 'true');
      }

      // Sort
      const validSortFields = ['name', 'created_at', 'rep_count', 'player_count', 'address_state'];
      const sortField = validSortFields.includes(sort_by) ? sort_by : 'name';
      const sortDirection = sort_order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

      query += ` ORDER BY ${sortField} ${sortDirection}`;

      // Pagination
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));

      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset));

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM clubs WHERE 1=1';
      const countParams = [];
      let countParamCount = 0;

      if (search) {
        countParamCount++;
        countQuery += ` AND (name ILIKE $${countParamCount} OR address_city ILIKE $${countParamCount} OR address_state ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }

      if (state) {
        countParamCount++;
        countQuery += ` AND address_state = $${countParamCount}`;
        countParams.push(state);
      }

      if (club_type) {
        countParamCount++;
        countQuery += ` AND club_type = $${countParamCount}`;
        countParams.push(club_type);
      }

      if (is_verified !== '') {
        countParamCount++;
        countQuery += ` AND is_verified = $${countParamCount}`;
        countParams.push(is_verified === 'true');
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      return res.status(200).json({
        success: true,
        clubs: result.rows,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + result.rows.length < totalCount,
        },
      });
    } catch (error) {
      console.error('Error fetching clubs:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch clubs',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // POST - Create new club
  if (req.method === 'POST') {
    try {
      const {
        name,
        club_type = 'golf_course',
        address_street,
        address_city,
        address_state,
        address_postcode,
        address_country = 'USA',
        latitude,
        longitude,
        phone,
        email,
        website,
        facebook_url,
        instagram_url,
        twitter_url,
        is_verified = false,
      } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Club name is required',
        });
      }

      // Generate slug
      const slug = generateSlug(name, address_city, address_state);

      // Check for existing slug
      const existingCheck = await pool.query(
        'SELECT club_id FROM clubs WHERE slug = $1',
        [slug]
      );

      let finalSlug = slug;
      if (existingCheck.rows.length > 0) {
        // Add random suffix if slug exists
        finalSlug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
      }

      // Build full address
      const fullAddress = [address_street, address_city, address_state, address_postcode, address_country]
        .filter(Boolean)
        .join(', ');

      // Insert club
      const result = await pool.query(
        `INSERT INTO clubs (
          name, slug, club_type,
          address_street, address_city, address_state, address_postcode, address_country,
          full_address, latitude, longitude,
          phone, email, website,
          facebook_url, instagram_url, twitter_url,
          is_active, is_verified,
          created_by_admin_id
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          $18, $19,
          $20
        ) RETURNING *`,
        [
          name,
          finalSlug,
          club_type,
          address_street,
          address_city,
          address_state,
          address_postcode,
          address_country,
          fullAddress,
          latitude,
          longitude,
          phone,
          email,
          website,
          facebook_url,
          instagram_url,
          twitter_url,
          true, // is_active
          is_verified,
          adminCheck.playerId,
        ]
      );

      return res.status(201).json({
        success: true,
        message: 'Club created successfully',
        club: result.rows[0],
      });
    } catch (error) {
      console.error('Error creating club:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create club',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
  });
}
