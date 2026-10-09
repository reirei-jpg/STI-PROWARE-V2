import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Boxes,
    CalendarClock,
    CalendarDays,
    CheckCircle2,
    FileScan,
    Flame,
    Hourglass,
    Link2,
    PackageCheck,
    Snail,
    TriangleAlert,
    Truck,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import PageHeader from '@/components/page-header';
import SchoolAdminOverview from '@/components/school-admin-overview';
import type { SchoolAdminOverviewData } from '@/components/school-admin-overview';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types';

type Task = {
    key: string;
    kind:
        | 'order'
        | 'low_stock'
        | 'out_of_stock'
        | 'split'
        | 'link'
        | 'delivery'
        | 'last_day'
        | 'sale_ending'
        | 'preorders'
        | 'slow_moving'
        | 'more';
    title: string;
    detail: string;
    action: { label: string; url: string; method: 'get' | 'post' };
};

type SpecialistTasks = {
    now: Task[];
    today: Task[];
    week: Task[];
};

const taskIcons: Record<Task['kind'], LucideIcon> = {
    order: PackageCheck,
    low_stock: TriangleAlert,
    out_of_stock: TriangleAlert,
    split: Boxes,
    link: Link2,
    delivery: Truck,
    last_day: Hourglass,
    sale_ending: Flame,
    preorders: CalendarClock,
    slow_moving: Snail,
    more: ArrowRight,
};

const taskIconClasses: Partial<Record<Task['kind'], string>> = {
    order: 'bg-blue-50 text-blue-700',
    low_stock: 'bg-amber-50 text-amber-700',
    out_of_stock: 'bg-red-50 text-red-700',
    split: 'bg-emerald-50 text-emerald-700',
    link: 'bg-amber-50 text-amber-700',
    delivery: 'bg-blue-50 text-blue-700',
    last_day: 'bg-red-50 text-red-700',
    sale_ending: 'bg-red-50 text-red-600',
    preorders: 'bg-amber-50 text-amber-700',
    slow_moving: 'bg-slate-100 text-slate-600',
};

export default function Dashboard({
    tasks,
    overview,
}: {
    tasks: SpecialistTasks | null;
    overview: SchoolAdminOverviewData | null;
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const firstName = auth.user.name.split(' ')[0];
    // Which group's tasks are open in the popup.
    const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);

    if (tasks === null) {
        return overview === null ? null : (
            <SchoolAdminOverview firstName={firstName} overview={overview} />
        );
    }

    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning'
            : hour < 18
              ? 'Good afternoon'
              : 'Good evening';
    const today = new Intl.DateTimeFormat('en-PH', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());
    const allClear =
        tasks.now.length + tasks.today.length + tasks.week.length === 0;

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-6">
                <PageHeader
                    title={`${greeting}, ${firstName}`}
                    description={`${today} · here is what needs you, most urgent first.`}
                />

                <section className="grid gap-4 md:grid-cols-2">
                    <Link
                        href={DeliveryController.create()}
                        className="group flex items-center gap-4 rounded-3xl bg-linear-to-br from-[#0D6EFD] to-blue-700 p-5 text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
                    >
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                            <Truck size={28} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-lg font-black">
                                Record Delivery
                            </span>
                            <span className="block text-sm text-blue-50">
                                Count what arrived from the supplier and add it
                                to stock.
                            </span>
                        </span>
                        <ArrowRight
                            size={22}
                            className="shrink-0 transition group-hover:translate-x-1"
                        />
                    </Link>
                    <Link
                        href={PurchaseOrderScanController.create()}
                        className="group flex items-center gap-4 rounded-3xl border-2 border-[#0D6EFD] bg-white p-5 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50/50 hover:shadow-md"
                    >
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0D6EFD]">
                            <FileScan size={28} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-lg font-black text-[#0D6EFD]">
                                Scan eStore PO
                            </span>
                            <span className="block text-sm text-slate-500">
                                Add a purchase order from the eStore email.
                            </span>
                        </span>
                        <ArrowRight
                            size={22}
                            className="shrink-0 text-[#0D6EFD] transition group-hover:translate-x-1"
                        />
                    </Link>
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-sm font-black tracking-wide text-slate-700 uppercase">
                            Your tasks
                        </h2>
                        <p className="text-sm text-slate-500">
                            {allClear
                                ? 'All clear. Nothing needs you this week.'
                                : 'Click a card to see its tasks.'}
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {groups.map((group) => (
                            <TaskGroupCard
                                key={group.key}
                                group={group}
                                tasks={tasks[group.key]}
                                onOpen={() => setOpenGroup(group.key)}
                            />
                        ))}
                    </div>
                </section>
            </div>

            <TaskGroupDialog
                group={groups.find((group) => group.key === openGroup) ?? null}
                tasks={openGroup ? tasks[openGroup] : []}
                onClose={() => setOpenGroup(null)}
            />
        </>
    );
}

type GroupKey = 'now' | 'today' | 'week';

type Group = {
    key: GroupKey;
    title: string;
    icon: LucideIcon;
    dotClassName: string;
    iconClassName: string;
    hoverClassName: string;
    emptyText: string;
};

/** The three groups, most urgent first, in V1's colors. */
const groups: Group[] = [
    {
        key: 'now',
        title: 'Do now',
        icon: Flame,
        dotClassName: 'bg-red-500',
        iconClassName: 'bg-red-50 text-red-600',
        hoverClassName: 'hover:border-red-300',
        emptyText: 'Nothing to do right now.',
    },
    {
        key: 'today',
        title: 'Today',
        icon: CalendarClock,
        dotClassName: 'bg-amber-400',
        iconClassName: 'bg-amber-50 text-amber-600',
        hoverClassName: 'hover:border-amber-300',
        emptyText: 'Nothing else for today.',
    },
    {
        key: 'week',
        title: 'This week',
        icon: CalendarDays,
        dotClassName: 'bg-blue-500',
        iconClassName: 'bg-blue-50 text-blue-600',
        hoverClassName: 'hover:border-blue-300',
        emptyText: 'Nothing coming up this week.',
    },
];

/** Tasks in a group, not counting the "and N more" link. */
function countTasks(tasks: Task[]): number {
    return tasks.filter((task) => task.kind !== 'more').length;
}

/**
 * One group of the to-do list ("Do now", "Today", "This week") as a card:
 * how many tasks and the first one; clicking it opens them all in a popup.
 */
function TaskGroupCard({
    group,
    tasks,
    onOpen,
}: {
    group: Group;
    tasks: Task[];
    onOpen: () => void;
}) {
    const Icon = group.icon;
    const count = countTasks(tasks);
    const first = tasks.find((task) => task.kind !== 'more');

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(
                'group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                group.hoverClassName,
            )}
        >
            <span className="flex items-center justify-between gap-3">
                <span
                    className={cn(
                        'flex size-11 items-center justify-center rounded-2xl',
                        group.iconClassName,
                    )}
                >
                    <Icon size={21} />
                </span>
                <span className="flex items-center gap-1 text-sm font-black text-blue-700 opacity-0 transition group-hover:opacity-100">
                    See all
                    <ArrowRight size={15} />
                </span>
            </span>
            <span className="mt-4 flex items-center gap-2 text-xs font-black tracking-wide text-slate-500 uppercase">
                <span
                    className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        group.dotClassName,
                    )}
                />
                {group.title}
            </span>
            <span className="mt-0.5 text-3xl font-black tracking-tight text-slate-900">
                {count}{' '}
                <span className="text-base font-bold text-slate-500">
                    {count === 1 ? 'task' : 'tasks'}
                </span>
            </span>
            <span className="mt-2 line-clamp-1 text-sm text-slate-500">
                {first ? (
                    first.title
                ) : (
                    <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        {group.emptyText}
                    </span>
                )}
            </span>
        </button>
    );
}

/**
 * A group's tasks in a popup that scrolls, each with its button (open the
 * order, record the delivery, ...). Done tasks disappear by themselves.
 */
function TaskGroupDialog({
    group,
    tasks,
    onClose,
}: {
    group: Group | null;
    tasks: Task[];
    onClose: () => void;
}) {
    const count = countTasks(tasks);

    return (
        <Dialog
            open={group !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-2xl [&>button:last-child]:hidden">
                {group && (
                    <>
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <span
                                    className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                                        group.iconClassName,
                                    )}
                                >
                                    <group.icon size={22} />
                                </span>
                                <div>
                                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                                        <span
                                            className={cn(
                                                'h-2.5 w-2.5 rounded-full',
                                                group.dotClassName,
                                            )}
                                        />
                                        {group.title}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-slate-500">
                                        {count} {count === 1 ? 'task' : 'tasks'}
                                        , most urgent first
                                    </DialogDescription>
                                </div>
                            </div>
                            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {tasks.length === 0 ? (
                                <div className="px-6 py-12 text-center">
                                    <CheckCircle2
                                        size={40}
                                        className="mx-auto text-emerald-500"
                                    />
                                    <p className="mt-3 font-black text-slate-900">
                                        All done
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {group.emptyText}
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {tasks.map((task) => (
                                        <TaskRow key={task.key} task={task} />
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
                            <DialogClose className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                                Close
                            </DialogClose>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function TaskRow({ task }: { task: Task }) {
    const Icon = taskIcons[task.kind];

    if (task.kind === 'more') {
        return (
            <li>
                <Link
                    href={task.action.url}
                    className="flex items-center justify-between gap-3 px-6 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                >
                    {task.title}
                    <ArrowRight size={16} />
                </Link>
            </li>
        );
    }

    return (
        <li className="flex flex-col gap-3 px-6 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
                <span
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        taskIconClasses[task.kind],
                    )}
                >
                    <Icon size={19} />
                </span>
                <div>
                    <p className="font-black text-slate-900">{task.title}</p>
                    {task.detail && (
                        <p className="mt-0.5 text-sm text-slate-500">
                            {task.detail}
                        </p>
                    )}
                </div>
            </div>
            <Link
                href={task.action.url}
                method={task.action.method}
                as={task.action.method === 'post' ? 'button' : 'a'}
                preserveScroll
                className={cn(
                    'inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border px-3.5 text-sm font-black transition sm:self-auto',
                    task.action.method === 'post'
                        ? 'border-[#0D6EFD] bg-[#0D6EFD] text-white hover:bg-blue-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                )}
            >
                {task.action.label}
            </Link>
        </li>
    );
}
