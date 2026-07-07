/**
 * Pricing — single source of truth for the landing page plan comparison.
 *
 * The number is deliberately TBD until after launch (PRD §7): keep it in ONE
 * place so it's never scattered as literals across the UI. When `PAID_PLAN.price`
 * is null the UI shows "Price announced at launch"; set it to e.g. "$19/mo" to
 * publish the real number. Pure module — no server/client imports.
 */

export const FREE_PLAN = {
  analyses: 1,
} as const;

export const PAID_PLAN = {
  analysesPerMonth: 10,
  /** Set the launch price here, e.g. "$19/mo". null → "Price announced at launch". */
  price: null as string | null,
};
