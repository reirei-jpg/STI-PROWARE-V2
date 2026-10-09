import type { ReactNode } from 'react';
import { formatDateOrdered, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IssuanceSlipData } from '@/types';

/** The paper form has room for this many items; empty lines fill the rest. */
const PAPER_LINES = 6;

/** Keep the gold bands when printed (browsers drop backgrounds otherwise). */
const keepColors = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
} as const;

/**
 * An order's issuance slip, laid out like STI College-Ormoc's paper form:
 * the school's name and address, ISSUANCE SLIP on a gold band, No. (the
 * order number) and Date, Student Name and Section, the items with
 * QTY / ITEM / UNIT PRICE / AMOUNT / Received By, the Payment boxes, the
 * Total Amount and the two signatures. The QR at the top-right holds the
 * order's slip code, which the Specialist scans. A cancelled slip is
 * stamped CANCELLED and a released one RELEASED, so it cannot be used
 * twice.
 */
export default function IssuanceSlip({
    slip,
    className,
}: {
    slip: IssuanceSlipData;
    className?: string;
}) {
    const emptyLines = Math.max(0, PAPER_LINES - slip.items.length);

    return (
        <article
            style={keepColors}
            className={cn(
                'relative mx-auto w-full max-w-3xl overflow-hidden border border-slate-300 bg-white p-6 text-[13px] text-slate-900 sm:p-8',
                className,
            )}
        >
            <header className="text-center">
                <p className="text-lg font-black tracking-wide">
                    {slip.school}
                </p>
                {slip.address_lines.map((line) => (
                    <p key={line} className="text-xs text-slate-600">
                        {line}
                    </p>
                ))}
            </header>

            <p className="mt-3 border-y-2 border-[#1E4E9C] bg-[#F7D44C] py-1.5 text-center text-base font-black tracking-[0.3em]">
                ISSUANCE SLIP
            </p>

            <SlipStamp status={slip.status} />

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
                <dl className="grid content-start gap-x-6 gap-y-3 sm:grid-cols-2">
                    <SlipField label="No.">
                        <span className="text-base font-black text-red-700">
                            {slip.number}
                        </span>
                    </SlipField>
                    <SlipField label="Date">
                        {formatDateOrdered(slip.date)}
                    </SlipField>
                    <SlipField label="Student Name">
                        {slip.student_name}
                    </SlipField>
                    <SlipField label="Section">{slip.section ?? ''}</SlipField>
                </dl>

                {slip.qr_svg && (
                    <figure className="w-24 text-center sm:w-28">
                        <div
                            className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full"
                            // The QR is drawn by the server from the slip code.
                            dangerouslySetInnerHTML={{ __html: slip.qr_svg }}
                        />
                        <figcaption className="mt-1 text-[10px] leading-tight text-slate-500">
                            Scan at the PROWARE office
                        </figcaption>
                    </figure>
                )}
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-136 border-collapse border border-[#1E4E9C] text-left">
                    <thead className="bg-[#F7D44C] text-[11px] font-black">
                        <tr>
                            <SlipHeading rowSpan={2} className="w-14">
                                QTY
                            </SlipHeading>
                            <SlipHeading rowSpan={2}>ITEM</SlipHeading>
                            <SlipHeading rowSpan={2} className="w-24">
                                UNIT PRICE
                            </SlipHeading>
                            <SlipHeading rowSpan={2} className="w-24">
                                AMOUNT
                            </SlipHeading>
                            <SlipHeading colSpan={2}>Received By</SlipHeading>
                        </tr>
                        <tr>
                            <SlipHeading className="w-28">
                                Signature
                            </SlipHeading>
                            <SlipHeading className="w-24">Date</SlipHeading>
                        </tr>
                    </thead>
                    <tbody>
                        {slip.items.map((line, index) => (
                            <tr key={index}>
                                <SlipCell className="text-center font-bold">
                                    {line.quantity}
                                </SlipCell>
                                <SlipCell>{line.item}</SlipCell>
                                <SlipCell className="text-right">
                                    {formatPeso(line.unit_price_centavos)}
                                </SlipCell>
                                <SlipCell className="text-right font-bold">
                                    {formatPeso(line.amount_centavos)}
                                </SlipCell>
                                <SlipCell />
                                <SlipCell className="text-xs">
                                    {slip.released_on &&
                                        formatDateOrdered(slip.released_on)}
                                </SlipCell>
                            </tr>
                        ))}
                        {Array.from({ length: emptyLines }, (_, index) => (
                            <tr key={`empty-${index}`} className="h-7">
                                {Array.from({ length: 6 }, (_, cell) => (
                                    <SlipCell key={cell} />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                    <p className="font-black">Payment:</p>
                    <ul className="mt-1 space-y-1">
                        <PaymentBox>
                            OR No.{' '}
                            <span className="inline-block w-28 border-b border-slate-500" />
                        </PaymentBox>
                        <PaymentBox>Charge to student account</PaymentBox>
                        <PaymentBox>
                            Salary Deduction to faculty/Staff
                        </PaymentBox>
                    </ul>
                </div>
                <p className="self-start border-2 border-[#1E4E9C] px-4 py-2 text-right">
                    <span className="block text-[11px] font-black">
                        Total Amount
                    </span>
                    <span className="text-xl font-black">
                        {formatPeso(slip.total_centavos)}
                    </span>
                </p>
            </div>

            <p className="mt-5 font-bold">Received all the above items:</p>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <SignatureLine
                    name={slip.issued_by}
                    label="Issued by (Signature Over Printed Name)"
                />
                <SignatureLine
                    name={slip.student_name}
                    label="Student Signature Over Printed Name"
                />
            </div>
        </article>
    );
}

function SlipField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-end gap-2">
            <dt className="shrink-0 font-black">{label}:</dt>
            <dd className="min-h-5 flex-1 border-b border-slate-500 pb-0.5">
                {children}
            </dd>
        </div>
    );
}

function SlipHeading({
    className,
    children,
    ...span
}: {
    className?: string;
    children: ReactNode;
    rowSpan?: number;
    colSpan?: number;
}) {
    return (
        <th
            {...span}
            className={cn(
                'border border-[#1E4E9C] px-2 py-1 text-center',
                className,
            )}
        >
            {children}
        </th>
    );
}

function SlipCell({
    className,
    children,
}: {
    className?: string;
    children?: ReactNode;
}) {
    return (
        <td className={cn('border border-[#1E4E9C] px-2 py-1', className)}>
            {children}
        </td>
    );
}

function PaymentBox({ children }: { children: ReactNode }) {
    return (
        <li className="flex items-center gap-2">
            <span className="inline-block size-3.5 shrink-0 border border-slate-600" />
            {children}
        </li>
    );
}

function SignatureLine({
    name,
    label,
}: {
    name: string | null;
    label: string;
}) {
    return (
        <div className="text-center">
            <p className="min-h-5 border-b border-slate-600 pb-0.5 font-bold">
                {name}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">{label}</p>
        </div>
    );
}

/**
 * CANCELLED in red or RELEASED in green across the slip, so a used or
 * cancelled slip is not taken for an open one.
 */
function SlipStamp({ status }: { status: IssuanceSlipData['status'] }) {
    if (status !== 'cancelled' && status !== 'picked_up') {
        return null;
    }

    return (
        <p
            aria-hidden
            className={cn(
                'pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-xl border-4 px-6 py-2 text-4xl font-black tracking-widest opacity-25 sm:text-5xl',
                status === 'cancelled'
                    ? 'border-red-600 text-red-600'
                    : 'border-emerald-600 text-emerald-600',
            )}
        >
            {status === 'cancelled' ? 'CANCELLED' : 'RELEASED'}
        </p>
    );
}
