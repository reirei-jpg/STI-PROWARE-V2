import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Banknote,
    Boxes,
    CalendarClock,
    CheckCircle2,
    FileScan,
    Flame,
    Hourglass,
    Link2,
    PackageCheck,
    Snail,
    TriangleAlert,
    Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DeliveryController from '@/actions/App/Http/Controllers/DeliveryController';
import OrderController from '@/actions/App/Http/Controllers/OrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import PageHeader from '@/components/page-header';
import SchoolAdminOverview from '@/components/school-admin-overview';
import type { SchoolAdminOverviewData } from '@/components/school-admin-overview';
import { formatPeso } from '@/lib/format';
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
    cash: {
        waiting_orders: number;
        waiting_centavos: number;
        collected_orders: number;
        collected_centavos: number;
    };
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

            <div className="space-y-7">
                <PageHeader
                    title={`${greeting}, ${firstName}`}
                    description={`${today} · here is what needs you, most urgent first.`}
                    actions={
                        <>
                            <Link
                                href={PurchaseOrderScanController.create()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                                <FileScan size={18} />
                                Scan eStore PO
                            </Link>
                            <Link
                                href={DeliveryController.create()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D6EFD] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
                            >
                                <Truck size={18} />
                                Record Delivery
                            </Link>
                        </>
                    }
                />

                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <SummaryTile
                        href={
                            OrderController.index({
                                query: { show: 'ready' },
                            }).url
                        }
                        icon={Banknote}
                        tone="amber"
                        label="To collect"
                        value={formatPeso(tasks.cash.waiting_centavos)}
                        detail={`${tasks.cash.waiting_orders} ${tasks.cash.waiting_orders === 1 ? 'order' : 'orders'} ready for pickup`}
                    />
                    <SummaryTile
                        href={
                            OrderController.index({
                                query: { show: 'picked_up' },
                            }).url
                        }
                        icon={CheckCircle2}
                        tone="green"
                        label="Collected today"
                        value={formatPeso(tasks.cash.collected_centavos)}
                        detail={`${tasks.cash.collected_orders} ${tasks.cash.collected_orders === 1 ? 'order' : 'orders'} released`}
                    />
                    <SummaryTile
                        href="#do-now"
                        icon={Flame}
                        tone="red"
                        label="Do now"
                        value={String(countTasks(tasks.now))}
                        detail={countTasks(tasks.now) === 1 ? 'task' : 'tasks'}
                    />
                    <SummaryTile
                        href="#today"
                        icon={CalendarClock}
                        tone="blue"
                        label="Today"
                        value={String(countTasks(tasks.today))}
                        detail={
                            countTasks(tasks.today) === 1 ? 'task' : 'tasks'
                        }
                    />
                </section>

                {allClear ? (
                    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-14 text-center">
                        <CheckCircle2
                            size={44}
                            className="mx-auto text-emerald-500"
                        />
                        <h2 className="mt-3 text-lg font-black text-emerald-900">
                            All clear
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm text-emerald-800">
                            No orders to prepare, nothing low on stock and no
                            deliveries expected this week.
                        </p>
                    </section>
                ) : (
                    <>
                        <TaskGroup
                            id="do-now"
                            title="Do now"
                            dotClassName="bg-red-500"
                            badgeClassName="bg-red-50 text-red-700"
                            tasks={tasks.now}
                        />
                        <TaskGroup
                            id="today"
                            title="Today"
                            dotClassName="bg-amber-400"
                            badgeClassName="bg-amber-50 text-amber-700"
                            tasks={tasks.today}
                        />
                        <TaskGroup
                            id="this-week"
                            title="This week"
                            dotClassName="bg-blue-500"
                            badgeClassName="bg-blue-50 text-blue-700"
                            tasks={tasks.week}
                        />
                    </>
                )}
            </div>
        </>
    );
}

/** Tasks in a group, not counting the "and N more" link. */
function countTasks(tasks: Task[]): number {
    return tasks.filter((task) => task.kind !== 'more').length;
}

const tileClasses = {
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
} as const;

/** One number at the top of the dashboard, opening what it counts. */
function SummaryTile({
    href,
    icon: Icon,
    tone,
    label,
    value,
    detail,
}: {
    href: string;
    icon: LucideIcon;
    tone: keyof typeof tileClasses;
    label: string;
    value: string;
    detail: string;
}) {
    const content = (
        <>
            <span
                className={cn(
                    'flex size-11 items-center justify-center rounded-2xl',
                    tileClasses[tone],
                )}
            >
                <Icon size={21} />
            </span>
            <span className="mt-4 block text-xs font-black tracking-wide text-slate-500 uppercase">
                {label}
            </span>
            <span className="mt-0.5 block text-2xl font-black tracking-tight text-slate-900">
                {value}
            </span>
            <span className="block text-sm text-slate-500">{detail}</span>
        </>
    );
    const classes =
        'block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';

    return href.startsWith('#') ? (
        <a href={href} className={classes}>
            {content}
        </a>
    ) : (
        <Link href={href} className={classes}>
            {content}
        </Link>
    );
}

/**
 * One group of the to-do list ("Do now", "Today", "This week"). An empty
 * group shrinks to one line that says so, so the Specialist knows nothing
 * was missed.
 */
function TaskGroup({
    id,
    title,
    dotClassName,
    badgeClassName,
    tasks,
}: {
    id: string;
    title: string;
    dotClassName: string;
    badgeClassName: string;
    tasks: Task[];
}) {
    if (tasks.length === 0) {
        return (
            <section
                id={id}
                className="flex scroll-mt-24 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm shadow-sm"
            >
                <span
                    className={cn('h-2.5 w-2.5 rounded-full', dotClassName)}
                />
                <span className="font-black tracking-wide text-slate-700 uppercase">
                    {title}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-slate-500">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    Nothing here
                </span>
            </section>
        );
    }

    return (
        <section
            id={id}
            className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
        >
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-sm font-black tracking-wide text-slate-700 uppercase">
                <span
                    className={cn('h-2.5 w-2.5 rounded-full', dotClassName)}
                />
                {title}
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-black',
                        badgeClassName,
                    )}
                >
                    {countTasks(tasks)}
                </span>
            </h2>
            <ul className="divide-y divide-slate-100">
                {tasks.map((task) => (
                    <TaskRow key={task.key} task={task} />
                ))}
            </ul>
        </section>
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
