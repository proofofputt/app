/**
 * Club Search API
 * ============================================================================
 * GET /api/clubs/search - Search and browse golf clubs
 *
 * Public endpoint for searching clubs by name, location, etc.
 * ============================================================================
 */

import { Pool } from 'pg';
import { setCORSHeaders } from '../../utils/cors.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  try {
    const {
      search = '',
      state = '',
      city = '',
      club_type = '',
      limit = 20,
      offset = 0,
    } = req.query;

    let query = `
      SELECT
        club_id,
        name,
        slug,
        club_type,
        address_street,
        address_city,
        address_state,
        address_postcode,
        full_address,
        latitude,
        longitude,
        phone,
        email,
        website,
        (SELECT COUNT(*) FROM club_representatives WHERE club_id = clubs.club_id AND is_active = TRUE) as rep_count
      FROM clubs
      WHERE is_active = TRUE
    `;

    const params = [];
    let paramCount = 0;

    // Search filter (name, city, or state)
    if (search) {
      paramCount++;
      query += ` AND (
        name ILIKE $${paramCount}
        OR address_city ILIKE $${paramCount}
        OR address_state ILIKE $${paramCount}
        OR full_address ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // State filter
    if (state) {
      paramCount++;
      query += ` AND address_state = $${paramCount}`;
      params.push(state);
    }

    // City filter
    if (city) {
      paramCount++;
      query += ` AND address_city ILIKE $${paramCount}`;
      params.push(`%${city}%`);
    }

    // Club type filter
    if (club_type) {
      paramCount++;
      query += ` AND club_type = $${paramCount}`;
      params.push(club_type);
    }

    // Sort by name
    query += ` ORDER BY name ASC`;

    // Pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM clubs WHERE is_active = TRUE';
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (
        name ILIKE $${countParamCount}
        OR address_city ILIKE $${countParamCount}
        OR address_state ILIKE $${countParamCount}
        OR full_address ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    if (state) {
      countParamCount++;
      countQuery += ` AND address_state = $${countParamCount}`;
      countParams.push(state);
    }

    if (city) {
      countParamCount++;
      countQuery += ` AND address_city ILIKE $${countParamCount}`;
      countParams.push(`%${city}%`);
    }

    if (club_type) {
      countParamCount++;
      countQuery += ` AND club_type = $${countParamCount}`;
      countParams.push(club_type);
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
    console.error('Error searching clubs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search clubs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
