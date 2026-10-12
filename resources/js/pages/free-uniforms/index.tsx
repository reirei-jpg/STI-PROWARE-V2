import { Head, router } from '@inertiajs/react';
import {
    CalendarDays,
    Download,
    Eye,
    Gift,
    Hourglass,
    Plus,
    SearchX,
    Shirt,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import FreeUniformController from '@/actions/App/Http/Controllers/FreeUniformController';
import FreeUniformGroupDialog from '@/components/free-uniform-group-dialog';
import { ViewTab, ViewTabs } from '@/components/list-tabs';
import PageHeader from '@/components/page-header';
import Pagination from '@/components/pagination';
import Panel, { TableHeading, TableScroll } from '@/components/panel';
import RecordFreeUniformGroupDialog from '@/components/record-free-uniform-group-dialog';
import SearchBox from '@/components/search-box';
import StatCard from '@/components/stat-card';
import UniformSetsDialog from '@/components/uniform-sets-dialog';
import { formatDateOrdered, formatDateTime } from '@/lib/format';
import { badgeClasses, buttonClasses } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type {
    FreeUniformFilters,
    FreeUniformGroupDetails,
    FreeUniformGroupRow,
    FreeUniformsShow,
    FreeUniformsSummary,
    Paginated,
    UniformSetOption,
} from '@/types';

/**
 * Free Uniforms (the enrollment promo), as a back office: students who
 * enroll together in a group of at least N each get one uniform set (a
 * blouse or polo and pants) for free. Four numbers at the top, the groups
 * recorded (newest first) with View Details, Record a group, the uniform
 * sets, and a download for Excel. Free pieces leave stock as "Free
 * (promo)", never as a sale.
 */
export default function FreeUniformsIndex({
    groups,
    summary,
    sets,
    products,
    details,
    filters,
    today,
}: {
    groups: Paginated<FreeUniformGroupRow>;
    summary: FreeUniformsSummary;
    sets: UniformSetOption[];
    products: { id: number; name: string }[];
    details?: FreeUniformGroupDetails | null;
    filters: FreeUniformFilters;
    today: string;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [recording, setRecording] = useState(false);
    const [managingSets, setManagingSets] = useState(false);
    const [viewingId, setViewingId] = useState<number | null>(null);
    const firstRender = useRef(true);

    const showList = (next: Partial<FreeUniformFilters>) => {
        const merged = { ...filters, ...next };
        const query: Record<string, string> = {};

        if (merged.show !== 'all') {
            query.show = merged.show;
        }

        if (merged.search) {
            query.search = merged.search;
        }

        router.get(FreeUniformController.index().url, query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Search as the Specialist types, after a short pause.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = window.setTimeout(
            () =>
                showList({
                    search: search.trim() === '' ? null : search.trim(),
                }),
            400,
        );

        return () => window.clearTimeout(timer);
        // Only the typed text should trigger a search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const openDetails = (groupId: number) => {
        setViewingId(groupId);
        router.reload({ data: { details: groupId }, only: ['details'] });
    };

    const showTab = (show: FreeUniformsShow) => showList({ show });

    return (
        <>
            <Head title="Free Uniforms" />

            <div className="space-y-6">
                <PageHeader
                    title="Free Uniforms (Promo)"
                    description={`Students who enroll together in a group of at least ${summary.group_size} each get one uniform set for free: a blouse or polo, and pants. The pieces leave stock as Free (promo), never as a sale.`}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setManagingSets(true)}
                                className={buttonClasses.secondary}
                            >
                                <Shirt size={17} />
                                Uniform sets
                            </button>
                            <a
                                href={
                                    FreeUniformController.export({
                                        query: filters.search
                                            ? { search: filters.search }
                                            : {},
                                    }).url
                                }
                                className={buttonClasses.secondary}
                            >
                                <Download size={17} />
                                Download for Excel
                            </a>
                            <button
                                type="button"
                                onClick={() =>
                                    sets.length === 0
                                        ? setManagingSets(true)
                                        : setRecording(true)
                                }
                                className={buttonClasses.primary}
                            >
                                <Plus size={18} />
                                Record a group
                            </button>
                        </div>
                    }
                />

                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard
                        icon={CalendarDays}
                        tone="blue"
                        label="This month"
                        value={summary.this_month}
                        detail={
                            summary.this_month === 1
                                ? 'student given a set'
                                : 'students given a set'
                        }
                    />
                    <StatCard
                        icon={Gift}
                        tone="green"
                        label="All students"
                        value={summary.students}
                        detail={
                            summary.students === 1
                                ? 'free set given'
                                : 'free sets given'
                        }
                    />
                    <StatCard
                        icon={Users}
                        tone="blue"
                        label="Groups"
                        value={summary.groups}
                        detail="enrolled together"
                    />
                    <StatCard
                        icon={Hourglass}
                        tone="amber"
                        label="Still to give"
                        value={summary.still_to_give}
                        detail={
                            summary.still_to_give === 1
                                ? 'student waiting for a piece'
                                : 'students waiting for a piece'
                        }
                        active={filters.show === 'still_to_give'}
                        onClick={() => showTab('still_to_give')}
                    />
                </section>

                {sets.length === 0 && (
                    <p className="rounded-2xl border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
                        <span className="font-black">
                            Set up the uniform sets first.
                        </span>{' '}
                        Open Uniform sets and add each course, e.g. BSIT = BSIT
                        Blouse or BSIT Polo + BSIT Pants. Then you can record
                        groups.
                    </p>
                )}

                <Panel>
                    <div className="space-y-4 border-b border-slate-100 px-6 py-5">
                        <ViewTabs>
                            <ViewTab
                                active={filters.show === 'all'}
                                onClick={() => showTab('all')}
                            >
                                All groups
                            </ViewTab>
                            <ViewTab
                                active={filters.show === 'still_to_give'}
                                count={summary.still_to_give}
                                onClick={() => showTab('still_to_give')}
                            >
                                Still to give
                            </ViewTab>
                        </ViewTabs>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <h2 className="font-black text-slate-900">
                                    {filters.show === 'all'
                                        ? 'Groups'
                                        : 'Groups with a piece still to give'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {filters.show === 'all'
                                        ? 'Newest enrollment date first. Open View Details to see each student, their set and sizes.'
                                        : 'A piece was out of stock when the group was recorded. Open View Details to give it now.'}
                                </p>
                            </div>
                            <SearchBox
                                value={search}
                                onChange={setSearch}
                                placeholder="Search by student name or Enrollment Form #"
                            />
                        </div>

                        {filters.search && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    showList({ search: null });
                                }}
                                className={buttonClasses.secondarySmall}
                            >
                                <X size={15} />
                                Clear search
                            </button>
                        )}
                    </div>

                    <GroupsTable
                        groups={groups}
                        isFiltered={Boolean(
                            filters.search || filters.show !== 'all',
                        )}
                        onView={openDetails}
                    />
                </Panel>
            </div>

            <RecordFreeUniformGroupDialog
                open={recording}
                sets={sets}
                groupSize={summary.group_size}
                today={today}
                onClose={() => setRecording(false)}
            />

            <UniformSetsDialog
                open={managingSets}
                sets={sets}
                products={products}
                onClose={() => setManagingSets(false)}
            />

            <FreeUniformGroupDialog
                open={viewingId !== null}
                // Another group's details (from before) count as loading.
                details={
                    details === null || details?.id === viewingId
                        ? details
                        : undefined
                }
                onClose={() => setViewingId(null)}
            />
        </>
    );
}

/** The groups recorded: when, who, which sets, what is still to give. */
function GroupsTable({
    groups,
    isFiltered,
    onView,
}: {
    groups: Paginated<FreeUniformGroupRow>;
    isFiltered: boolean;
    onView: (groupId: number) => void;
}) {
    if (groups.data.length === 0) {
        return (
            <div className="px-6 py-16 text-center">
                {isFiltered ? (
                    <SearchX size={44} className="mx-auto text-slate-300" />
                ) : (
                    <Gift size={44} className="mx-auto text-slate-300" />
                )}
                <h3 className="mt-4 text-lg font-black text-slate-800">
                    {isFiltered
                        ? 'No group matches'
                        : 'No free uniforms recorded yet'}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {isFiltered
                        ? 'Check the name or Enrollment Form #, or show all groups.'
                        : 'When students enroll together, use Record a group to give each of them a free set.'}
                </p>
            </div>
        );
    }

    return (
        <>
            <TableScroll>
                <table className="w-full min-w-225">
                    <thead className="bg-slate-50">
                        <tr>
                            <TableHeading>Group</TableHeading>
                            <TableHeading>Students</TableHeading>
                            <TableHeading>Sets</TableHeading>
                            <TableHeading>Status</TableHeading>
                            <TableHeading>Recorded By</TableHeading>
                            <TableHeading align="right">Actions</TableHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.data.map((group) => (
                            <tr
                                key={group.id}
                                className="border-t border-slate-100 align-top text-sm transition hover:bg-slate-50/70"
                            >
                                <td className="px-5 py-4">
                                    <p className="font-mono font-black text-blue-700">
                                        Group #{group.id}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        Enrolled{' '}
                                        {formatDateOrdered(group.enrolled_on)}
                                    </p>
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-black text-slate-900">
                                        {group.students_count} students
                                    </p>
                                    <p className="mt-0.5 max-w-64 truncate text-xs text-slate-500">
                                        {group.names.join(', ')}
                                        {group.more_names > 0 &&
                                            ` +${group.more_names} more`}
                                    </p>
                                </td>
                                <td className="px-5 py-4 font-bold text-slate-700">
                                    {group.sets}
                                </td>
                                <td className="px-5 py-4">
                                    <span
                                        className={cn(
                                            badgeClasses,
                                            group.still_to_give > 0
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-emerald-100 text-emerald-800',
                                        )}
                                    >
                                        {group.still_to_give > 0
                                            ? `${group.still_to_give} still to give`
                                            : 'All given'}
                                    </span>
                                </td>
                                <td className="px-5 py-4">
                                    <p className="font-semibold text-slate-700">
                                        {group.recorded_by}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        {formatDateTime(group.recorded_at)}
                                    </p>
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={() => onView(group.id)}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-black whitespace-nowrap text-blue-700 transition hover:bg-blue-100"
                                    >
                                        <Eye size={15} />
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableScroll>

            <Pagination pagination={groups} itemName="groups" />
        </>
    );
}
