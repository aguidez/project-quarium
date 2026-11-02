/**
 * The admin panel (client: AdminPanel, server: AdminService), the home of every administration tool. Who may use it
 * is decided by the server (server/admins.ts canUseAdminPanel) and told to the client by a player attribute; every
 * action is checked again on the server.
 */

/** Player attribute: true when the server lets this player open the admin panel. */
export const ADMIN_PANEL_ATTRIBUTE = "AdminPanel";

/** A tab of the panel: one per kind of tool. */
export type AdminTab = "Events";

/** The panel's tabs, in display order. */
export const ADMIN_TABS: { tab: AdminTab; label: string }[] = [{ tab: "Events", label: "Events" }];
