import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Banknote,
    Boxes,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
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
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController';
import PurchaseOrderScanController from '@/actions/App/Http/Controllers/PurchaseOrderScanController';
import PageHeader from '@/components/page-header';
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
}: {
    tasks: SpecialistTasks | null;
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const firstName = auth.user.name.split(' ')[0];

    if (tasks === null) {
        return <SchoolAdminDashboard firstName={firstName} />;
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
                            title="Do now"
                            dotClassName="bg-red-500"
                            tasks={tasks.now}
                        />
                        <TaskGroup
                            title="Today"
                            dotClassName="bg-amber-400"
                            tasks={tasks.today}
                        />
                        <TaskGroup
                            title="This week"
                            dotClassName="bg-blue-500"
                            tasks={tasks.week}
                        />
                    </>
                )}

                <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
                    <Link
                        href={OrderController.index({
                            query: { show: 'ready' },
                        })}
                        className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <PackageCheck size={20} />
                        </span>
                        <span>
                            <span className="block text-sm text-slate-500">
                                Waiting for pickup
                            </span>
                            <span className="block font-black text-slate-900">
                                {tasks.cash.waiting_orders}{' '}
                                {tasks.cash.waiting_orders === 1
                                    ? 'order'
                                    : 'orders'}{' '}
                                · {formatPeso(tasks.cash.waiting_centavos)} to
                                collect
                            </span>
                        </span>
                    </Link>
                    <Link
                        href={OrderController.index({
                            query: { show: 'picked_up' },
                        })}
                        className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Banknote size={20} />
                        </span>
                        <span>
                            <span className="block text-sm text-slate-500">
                                Collected today (cash)
                            </span>
                            <span className="block font-black text-slate-900">
                                {tasks.cash.collected_orders}{' '}
                                {tasks.cash.collected_orders === 1
                                    ? 'order'
                                    : 'orders'}{' '}
                                · {formatPeso(tasks.cash.collected_centavos)}
                            </span>
                        </span>
                    </Link>
                </section>
            </div>
        </>
    );
}

/**
 * One group of the to-do list ("Do now", "Today", "This week"). An empty
 * group says so, so the Specialist knows nothing was missed.
 */
function TaskGroup({
    title,
    dotClassName,
    tasks,
}: {
    title: string;
    dotClassName: string;
    tasks: Task[];
}) {
    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-sm font-black tracking-wide text-slate-700 uppercase">
                <span
                    className={cn('h-2.5 w-2.5 rounded-full', dotClassName)}
                />
                {title}
                <span className="font-bold text-slate-400 normal-case">
                    · {tasks.length === 0 ? 'nothing' : tasks.length}
                </span>
            </h2>
            {tasks.length === 0 ? (
                <p className="flex items-center gap-2 px-6 py-4 text-sm text-slate-500">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    Nothing here.
                </p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {tasks.map((task) => (
                        <TaskRow key={task.key} task={task} />
                    ))}
                </ul>
            )}
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
        <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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

/**
 * The School Admin only monitors purchase orders.
 */
function SchoolAdminDashboard({ firstName }: { firstName: string }) {
    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-7">
                <PageHeader
                    title={`Welcome, ${firstName}`}
                    description="Here is where your PROWARE work starts."
                />

                <section className="grid gap-4 md:grid-cols-2">
                    <Link
                        href={PurchaseOrderController.index()}
                        className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <ClipboardList size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-black text-slate-900">
                                Purchase Orders
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                See every eStore order the Specialist uploaded.
                                The bell at the top tells you when a new one
                                arrives.
                            </p>
                        </div>
                        <ArrowRight
                            size={18}
                            className="mt-1 shrink-0 text-slate-300 transition group-hover:text-blue-600"
                        />
                    </Link>
                </section>
            </div>
        </>
    );
}
