import { History, X } from 'lucide-react';

/**
 * Said at the top of a long form when what was typed before (and not yet
 * saved) was brought back, with a way to start over instead.
 */
export default function DraftRestoredNotice({
    onDiscard,
    onDismiss,
}: {
    onDiscard: () => void;
    onDismiss: () => void;
}) {
    return (
        <div
            role="status"
            className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center"
        >
            <History size={20} className="shrink-0 text-blue-600" />
            <p className="min-w-0 flex-1 leading-6">
                <span className="font-black">
                    What you typed before was brought back.
                </span>{' '}
                It was not saved yet; check it, then save.
            </p>
            <div className="flex shrink-0 gap-2">
                <button
                    type="button"
                    onClick={onDiscard}
                    className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
                >
                    Discard and start over
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Close this note"
                    className="rounded-xl p-2 text-blue-500 transition hover:bg-blue-100 hover:text-blue-800"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
