import { AppSidebar } from '@/components/app-sidebar';
import StaffTopBar from '@/components/staff-top-bar';

/**
 * The staff layout carried over from V1: fixed blue sidebar, white top bar
 * and a light grey-blue page background.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#F3F7FA]">
            <AppSidebar />
            <StaffTopBar />

            <main className="min-h-screen px-4 pt-28 pb-10 md:ml-72 md:px-8">
                {children}
            </main>
        </div>
    );
}
