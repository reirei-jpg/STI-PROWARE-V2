/**
 * Forms with unsaved changes (useUnsavedChanges) register here, newest last
 * (e.g. a popup over a page). Two ways of leaving go through them:
 *
 * - the browser's Back and Forward buttons: app.tsx listens for them before
 *   Inertia does and calls `window.prowareBack`, which keeps the page and
 *   lets the newest form with changes ask first;
 * - closing a popup (X, Cancel, a click outside, Esc): the popup calls
 *   confirmLeave with what closing does.
 *
 * app.tsx does not import this file: pages import it, and an import from the
 * app's entry would load the entry again from every page that uses it.
 */
type LeaveGuard = {
    /** Whether it has unsaved changes right now. */
    isDirty: () => boolean;
    /** Back was pressed: keep the page and ask. */
    onBack: () => void;
    /** Ask before `leave` runs. */
    ask: (leave: () => void) => void;
};

declare global {
    interface Window {
        /** Back was pressed: true when a form kept the page to ask first. */
        prowareBack?: () => boolean;
    }
}

const guards: LeaveGuard[] = [];

function onBack(): boolean {
    const guard = guards.findLast((each) => each.isDirty());

    if (guard === undefined) {
        return false;
    }

    guard.onBack();

    return true;
}

/**
 * Registers a form (while it is open); returns the way to remove it.
 */
export function addLeaveGuard(guard: LeaveGuard): () => void {
    window.prowareBack = onBack;
    guards.push(guard);

    return () => {
        const index = guards.lastIndexOf(guard);

        if (index !== -1) {
            guards.splice(index, 1);
        }
    };
}

/**
 * Closing a popup: asks first when a form inside it has unsaved changes,
 * otherwise closes at once.
 */
export function confirmLeave(leave: () => void): void {
    // The popup's own form is the newest; a page under it is not asked about.
    const guard = guards.at(-1);

    if (guard === undefined || !guard.isDirty()) {
        leave();

        return;
    }

    guard.ask(leave);
}
