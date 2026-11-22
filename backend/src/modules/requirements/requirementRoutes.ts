import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../../db/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { logAuditEvent } from '../../utils/audit';

export const requirementRouter = Router();

const RequirementSchema = z.object({
  movieTitle: z.string().min(2),
  preferredCity: z.string().min(2),
  preferredVenueId: z.string().optional(),
  preferredDate: z.string(), // YYYY-MM-DD
  preferredTime: z.string().optional(),
  maximumBudget: z.number().int().positive(), // in paise
  seatCategory: z.string().optional(),
  quantity: z.number().int().min(1).max(10).default(1),
});

// POST /api/v1/requirements (Buyer posts requirement)
requirementRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const data = RequirementSchema.parse(req.body);
    const buyerId = req.user!.id;
    const reqId = uuidv4();

    db.prepare(`
      INSERT INTO buyer_requirements (
        id, buyer_id, movie_title, preferred_city, preferred_venue_id,
        preferred_date, preferred_time, maximum_budget, seat_category, quantity, requirement_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      reqId,
      buyerId,
      data.movieTitle,
      data.preferredCity,
      data.preferredVenueId || null,
      data.preferredDate,
      data.preferredTime || null,
      data.maximumBudget,
      data.seatCategory || null,
      data.quantity
    );

    logAuditEvent({
      actorId: buyerId,
      action: 'BUYER_REQUIREMENT_POSTED',
      resourceType: 'buyer_requirement',
      resourceId: reqId,
      outcome: 'SUCCESS',
      details: { movie: data.movieTitle, city: data.preferredCity, budget: data.maximumBudget },
    });

    res.status(201).json({
      message: 'Buyer requirement saved. The system is scanning active listings for smart matches.',
      requirementId: reqId,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: (err as any).issues || (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to post requirement', message: err.message });
  }
});

// GET /api/v1/requirements (Get buyer's requirements)
requirementRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const requirements = db.prepare(`
    SELECT r.*, v.venue_name
    FROM buyer_requirements r
    LEFT JOIN venues v ON r.preferred_venue_id = v.id
    WHERE r.buyer_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user!.id);

  res.json({ requirements });
});

// GET /api/v1/requirements/:id/matches (Smart Match Engine)
requirementRouter.get('/:id/matches', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const requirement = db.prepare(`
    SELECT * FROM buyer_requirements
    WHERE id = ? AND buyer_id = ?
  `).get(req.params.id, req.user!.id) as any;

  if (!requirement) {
    res.status(404).json({ error: 'Requirement not found.' });
    return;
  }

  // Find all active listings and calculate smart match score
  const listings = db.prepare(`
    SELECT 
      l.id, l.ticket_id, l.seller_id, l.original_price, l.resale_price, l.quantity,
      l.listing_status, l.show_time, l.expires_at,
      t.seat_category, t.transfer_eligibility,
      e.event_name, e.event_date, e.city as event_city,
      v.id as venue_id, v.venue_name, v.address as venue_address,
      u.full_name as seller_name
    FROM listings l
    JOIN tickets t ON l.ticket_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.listing_status = 'active'
  `).all() as any[];

  const matches = listings.map((item) => {
    let score = 0;
    const matchReasons: string[] = [];

    // 1. Movie Title match (30 pts)
    if (item.event_name.toLowerCase().includes(requirement.movie_title.toLowerCase()) ||
        requirement.movie_title.toLowerCase().includes(item.event_name.toLowerCase())) {
      score += 30;
      matchReasons.push('Movie matches');
    }

    // 2. City match (20 pts)
    if (item.event_city.toLowerCase() === requirement.preferred_city.toLowerCase()) {
      score += 20;
      matchReasons.push('City matches');
    }

    // 3. Venue match (25 pts)
    if (requirement.preferred_venue_id && item.venue_id === requirement.preferred_venue_id) {
      score += 25;
      matchReasons.push('Exact venue matches');
    } else if (!requirement.preferred_venue_id && item.event_city.toLowerCase() === requirement.preferred_city.toLowerCase()) {
      score += 15;
      matchReasons.push('Venue in preferred city');
    }

    // 4. Date match (15 pts)
    if (item.event_date === requirement.preferred_date) {
      score += 15;
      matchReasons.push('Show date matches');
    }

    // 5. Budget compatibility (10 pts)
    if (item.resale_price <= requirement.maximum_budget) {
      score += 10;
      matchReasons.push('Within budget');
    }

    return {
      listing: item,
      matchScore: score,
      explanation: `${score}% match: ${matchReasons.join(', ')}.`,
      isRecommended: score >= 70,
    };
  })
  .filter((m) => m.matchScore >= 40) // only surface relevant listings
  .sort((a, b) => b.matchScore - a.matchScore);

  res.json({
    requirement,
    matches,
  });
});
