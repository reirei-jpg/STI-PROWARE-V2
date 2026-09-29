import { Link } from '@inertiajs/react';
import { ShoppingCart, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { login } from '@/routes';

const SignInPromptContext = createContext<() => void>(() => {});

/**
 * Anyone can browse the storefront; signing in is only asked for when they
 * try to add something to the cart. Wrap the storefront in this provider and
 * call `useSignInPrompt()` to open the sign-in window.
 */
export function SignInPromptProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <SignInPromptContext.Provider value={() => setOpen(true)}>
            {children}
            <SignInPromptDialog open={open} onOpenChange={setOpen} />
        </SignInPromptContext.Provider>
    );
}

export function useSignInPrompt(): () => void {
    return useContext(SignInPromptContext);
}

/**
 * The Microsoft logo used on "Sign in with Microsoft" buttons.
 */
export function MicrosoftLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
    );
}

function SignInPromptDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden rounded-3xl border-slate-200 p-0 sm:max-w-md [&>button:last-child]:hidden">
                <div className="flex justify-end px-5 pt-5">
                    <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                        <X size={20} />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </div>

                <div className="px-8 pb-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <ShoppingCart size={26} />
                    </div>

                    <DialogTitle className="mt-5 text-xl font-black text-slate-900">
                        Sign in to add items to your cart
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">
                        Use your STI Microsoft 365 account. You can keep
                        browsing without signing in.
                    </DialogDescription>

                    <button
                        type="button"
                        disabled
                        className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 opacity-70"
                    >
                        <MicrosoftLogo className="h-5 w-5" />
                        Sign in with Microsoft
                    </button>
                    <p className="mt-2 text-xs text-slate-400">
                        Microsoft 365 sign-in will be connected soon.
                    </p>

                    <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
                        STI staff?{' '}
                        <Link
                            href={login()}
                            className="font-bold text-blue-700 hover:underline"
                        >
                            Sign in with your staff account
                        </Link>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
