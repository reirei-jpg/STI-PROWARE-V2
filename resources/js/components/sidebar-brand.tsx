export default function SidebarBrand({ subtitle }: { subtitle: string }) {
    return (
        <div className="px-3">
            <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                    <img
                        src="/images/sti-logo.png"
                        alt="STI College"
                        className="h-full w-full object-cover"
                    />
                </div>

                <div className="min-w-0">
                    <p className="text-2xl font-black tracking-tight text-white">
                        PROWARE
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-blue-100">
                        {subtitle}
                    </p>
                </div>
            </div>
        </div>
    );
}
