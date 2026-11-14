// Who each partner plays in an info-gap challenge, shown at the top of the screen ("You're the shopkeeper").
// Hand-kept beside the generated tasks (promote.ts doesn't re-run over them), keyed by task id: [role A, role B].
// (Until 2026-11-14 every challenge said "the customer" / "the waiter", wrong for six of the eight.)
export const infoGapRoleNames: Record<string, [string, string]> = {
  "cafe-order-gap": ["the customer", "the waiter"],
  "gen-s0-repair-gap": ["the tourist", "the local"],
  "gen-s0-survive-gap": ["the customer", "the shopkeeper"],
  "gen-s1-cafe-order-gap": ["the customer", "the bartender"],
  "gen-s1-market-gap": ["the customer", "the seller"],
  "gen-s1-directions-gap": ["the visitor", "the local"],
  "gen-s2-arrange-gap": ["the one calling", "the friend who answers"],
  "gen-s2-problems-gap": ["the customer", "the waiter"],
};
