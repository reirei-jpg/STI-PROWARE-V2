/**
 * Opens the browser's calendar when a date box is clicked anywhere, not only
 * on its small calendar icon.
 */
export function openCalendar(event: { currentTarget: HTMLInputElement }): void {
    try {
        event.currentTarget.showPicker();
    } catch {
        // Some browsers allow it only from a click; typing still works.
    }
}
