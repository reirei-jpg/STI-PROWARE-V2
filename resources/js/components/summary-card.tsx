import type { LucideIcon } from 'lucide-react';

/**
 * A number at a glance (from V1), e.g. "Orders Uploaded: 12".
 */
export default function SummaryCard({
    label,
    value,
    description,
    icon: Icon,
}: {
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
}) {
    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-600">{label}</p>
                    <p className="mt-2 truncate text-3xl font-black text-slate-950">
                        {value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                        {description}
                    </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon size={20} />
                </div>
            </div>
        </article>
    );
}
