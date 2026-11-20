import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ConfirmDialog from '@/components/confirm-dialog';
import { addLeaveGuard } from '@/lib/back-guard';
import { logout } from '@/routes';

/**
 * Keeps typed work from being lost by accident. While `dirty` (something was
 * typed and not saved yet), leaving asks first, "Leave without saving?":
 *
 * - a link: the sidebar, the logo, the top bar, Back to…, Sign out;
 * - the browser's Back and Forward buttons (see back-guard);
 * - closing or reloading the tab (the browser's own question);
 * - closing the popup the form is in: the popup's close goes through
 *   `confirmLeave` from back-guard (X, Cancel, a click outside, Esc).
 *
 * The form's own Save is not asked about. `kept: true` says the form keeps a
 * draft (useFormDraft); `notKept` says what the draft cannot keep.
 * Render `prompt` once inside the form.
 *
 * The form's own Cancel uses `confirmDiscard` instead: "Discard what you
 * typed?", and Discard throws the draft away, so the form opens empty next
 * time (user's decision, 20 Nov 2026). Only an accidental leave keeps it.
 */
export function useUnsavedChanges(
    dirty: boolean,
    { kept = false, notKept }: { kept?: boolean; notKept?: string } = {},
): {
    confirmLeave: (leave: () => void) => void;
    confirmDiscard: (discard: () => void) => void;
    prompt: ReactNode;
} {
    const [pending, setPending] = useState<(() => void) | null>(null);
    const [discarding, setDiscarding] = useState<(() => void) | null>(null);
    const dirtyRef = useRef(dirty);
    // Set once Leave was chosen, so the leaving itself is not asked about.
    const leaving = useRef(false);
    // This page's address, to go back to when Back is pressed: by the time
    // the browser says Back was pressed, the address has already changed.
    const here = useRef<{ state: unknown; url: string } | null>(null);

    useEffect(() => {
        dirtyRef.current = dirty;

        if (dirty) {
            here.current = {
                state: window.history.state as unknown,
                url: window.location.href,
            };
        } else {
            // Saved or closed: the next change is asked about again.
            leaving.current = false;
        }
    }, [dirty]);

    const isDirty = useCallback(() => dirtyRef.current && !leaving.current, []);

    // Back and popup closing ask the newest form (see back-guard).
    useEffect(
        () =>
            addLeaveGuard({
                isDirty,
                onBack: () => {
                    // The address goes back to this page, then it asks.
                    if (here.current !== null) {
                        window.history.pushState(
                            here.current.state,
                            '',
                            here.current.url,
                        );
                    }

                    setPending(() => () => {
                        leaving.current = true;
                        window.history.go(-1);
                    });
                },
                ask: (leave) => setPending(() => leave),
            }),
        [isDirty],
    );

    // Links and visits: asked about, then made again on Leave.
    useEffect(
        () =>
            router.on('before', (event) => {
                const visit = event.detail.visit;

                if (!isDirty() || visit.prefetch) {
                    return;
                }

                if (visit.method === 'get') {
                    // A part of this page loading (e.g. a popup's details) is not leaving.
                    if (visit.only.length > 0 || visit.async) {
                        return;
                    }
                } else if (
                    new URL(logout().url, window.location.origin).pathname !==
                    visit.url.pathname
                ) {
                    // The form's own Save, or a step on this page.
                    return;
                }

                setPending(() => () => {
                    leaving.current = true;
                    router.visit(visit.url, {
                        method: visit.method,
                        data: visit.data,
                    });
                });

                return false;
            }),
        [isDirty],
    );

    // Closing or reloading the tab: the browser's own question.
    useEffect(() => {
        if (!dirty) {
            return;
        }

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (leaving.current) {
                return;
            }

            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', onBeforeUnload);

        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const confirmLeave = useCallback(
        (leave: () => void) => {
            if (isDirty()) {
                setPending(() => leave);
            } else {
                leave();
            }
        },
        [isDirty],
    );

    /** Cancel: ask before throwing away what was typed (and its draft). */
    const confirmDiscard = useCallback(
        (discard: () => void) => {
            if (isDirty()) {
                setDiscarding(() => discard);
            } else {
                leaving.current = true;
                discard();
            }
        },
        [isDirty],
    );

    const prompt = (
        <>
            <ConfirmDialog
                open={discarding !== null}
                title="Discard what you typed?"
                description="The form will be empty the next time you open it. This cannot be undone."
                cancelLabel="Keep editing"
                confirmLabel="Discard"
                tone="red"
                onConfirm={() => {
                    const discard = discarding;
                    setDiscarding(null);
                    leaving.current = true;
                    discard?.();
                }}
                onClose={() => setDiscarding(null)}
            />
            <LeavePrompt
                open={pending !== null}
                kept={kept}
                notKept={notKept}
                onConfirm={() => {
                    const leave = pending;
                    setPending(null);
                    leave?.();
                }}
                onClose={() => setPending(null)}
            />
        </>
    );

    return { confirmLeave, confirmDiscard, prompt };
}

/** "Leave without saving?" for a leave by accident (a link, Back, X). */
function LeavePrompt({
    open,
    kept,
    notKept,
    onConfirm,
    onClose,
}: {
    open: boolean;
    kept: boolean;
    notKept?: string;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <ConfirmDialog
            open={open}
            title="Leave without saving?"
            description={
                kept
                    ? `What you typed is kept as a draft and comes back when you open this form again.${notKept ? ` ${notKept}` : ''}`
                    : 'What you typed will be lost. This cannot be undone.'
            }
            cancelLabel="Keep editing"
            confirmLabel="Leave"
            tone="red"
            onConfirm={onConfirm}
            onClose={onClose}
        />
    );
}

/**
 * The same, for a form whose "changed" is only known inside it, e.g. an
 * Inertia `<Form>`: render `<UnsavedChangesGuard dirty={isDirty} />` in it.
 */
export function UnsavedChangesGuard({
    dirty,
    kept = false,
}: {
    dirty: boolean;
    kept?: boolean;
}) {
    return useUnsavedChanges(dirty, { kept }).prompt;
}
