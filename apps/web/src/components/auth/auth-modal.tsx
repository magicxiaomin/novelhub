'use client';

import Script from 'next/script';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { cloneElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth, type AuthModalMode, type AuthModalOptions } from '@/components/providers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  requestPasswordReset,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import messages from '@/../messages/en.json';

type GoogleCredentialResponse = { credential?: string };

type GoogleAccounts = {
  id: {
    initialize: (config: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
      element: HTMLElement,
      options: { type: 'standard'; theme: 'outline'; size: 'large'; width: number },
    ) => void;
  };
};

declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts };
  }
}

const emailPasswordSchema = z.object({
  email: z.string().email(messages.auth.validationEmail),
  password: z.string().min(8, messages.auth.validationPassword),
});

const signupSchema = emailPasswordSchema
  .extend({
    confirmPassword: z.string().min(8, messages.auth.validationPassword),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: messages.auth.validationConfirm,
  });

const resetRequestSchema = z.object({
  email: z.string().email(messages.auth.validationEmail),
});

type SigninValues = z.infer<typeof emailPasswordSchema>;
type SignupValues = z.infer<typeof signupSchema>;
type ResetRequestValues = z.infer<typeof resetRequestSchema>;

export function AuthModal({
  open,
  options,
  onOpenChange,
}: {
  open: boolean;
  options: AuthModalOptions;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { refetch } = useAuth();
  const [mode, setMode] = useState<AuthModalMode>(options.mode ?? 'signin');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!open) return;
    setMode(options.mode ?? 'signin');
    setResetOpen(options.forgotPassword ?? false);
    setResetSent(false);
  }, [open, options.mode, options.forgotPassword]);

  const signinForm = useForm<SigninValues>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: { email: '', password: '' },
  });
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const resetForm = useForm<ResetRequestValues>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
  });

  const finishAuth = async (): Promise<void> => {
    await refetch();
    onOpenChange(false);
    options.afterSuccess?.();
  };

  const signin = useMutation({
    mutationFn: loginWithEmail,
    onSuccess: () => void finishAuth(),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        toast.error(messages.auth.invalidCredentials);
        return;
      }
      toast.error(messages.auth.genericError);
    },
  });

  const signup = useMutation({
    mutationFn: (values: SignupValues) =>
      registerWithEmail({ email: values.email, password: values.password }),
    onSuccess: () => void finishAuth(),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(messages.auth.emailRegistered);
        return;
      }
      toast.error(messages.auth.genericError);
    },
  });

  const googleLogin = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: () => void finishAuth(),
    onError: () => toast.error(messages.auth.googleError),
  });

  const resetRequest = useMutation({
    mutationFn: (values: ResetRequestValues) => requestPasswordReset(values.email),
    onSuccess: () => setResetSent(true),
    onError: () => toast.error(messages.auth.genericError),
  });

  const renderGoogleButton = useMemo(
    () => (): void => {
      if (!googleClientId || !googleButtonRef.current || !window.google?.accounts?.id) return;
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            toast.error(messages.auth.googleError);
            return;
          }
          googleLogin.mutate(response.credential);
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: 320,
      });
    },
    [googleClientId, googleLogin],
  );

  useEffect(() => {
    if (open) renderGoogleButton();
  }, [open, mode, renderGoogleButton]);

  const title = mode === 'signin' ? messages.auth.title : messages.auth.signupTitle;

  return (
    <>
      {googleClientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onReady={renderGoogleButton}
        />
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent labelledBy="auth-modal-title" closeLabel={messages.auth.closeDialog}>
          <DialogHeader>
            <DialogTitle id="auth-modal-title">
              {resetOpen ? messages.auth.resetTitle : title}
            </DialogTitle>
            {resetOpen ? <DialogDescription>{messages.auth.resetBody}</DialogDescription> : null}
          </DialogHeader>

          {resetOpen ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={resetForm.handleSubmit((v) => resetRequest.mutate(v))}
            >
              {resetSent ? (
                <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  {messages.auth.resetSent}
                </p>
              ) : null}
              <Field
                id="reset-email"
                label={messages.auth.email}
                error={resetForm.formState.errors.email?.message}
              >
                <Input type="email" autoComplete="email" {...resetForm.register('email')} />
              </Field>
              <Button
                type="submit"
                disabled={resetRequest.isPending}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {messages.auth.resetSubmit}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setResetOpen(false)}
              >
                {messages.auth.backToSignin}
              </Button>
            </form>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 rounded-lg bg-muted p-1">
                {(['signin', 'signup'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      'h-10 rounded-md text-sm font-semibold',
                      mode === tab
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground',
                    )}
                    onClick={() => setMode(tab)}
                  >
                    {tab === 'signin' ? messages.auth.signinTab : messages.auth.signupTab}
                  </button>
                ))}
              </div>

              {mode === 'signin' ? (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={signinForm.handleSubmit((v) => signin.mutate(v))}
                >
                  <Field
                    id="signin-email"
                    label={messages.auth.email}
                    error={signinForm.formState.errors.email?.message}
                  >
                    <Input type="email" autoComplete="email" {...signinForm.register('email')} />
                  </Field>
                  <Field
                    id="signin-password"
                    label={messages.auth.password}
                    error={signinForm.formState.errors.password?.message}
                  >
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...signinForm.register('password')}
                    />
                  </Field>
                  <button
                    type="button"
                    className="text-sm font-medium text-brand"
                    onClick={() => setResetOpen(true)}
                  >
                    {messages.auth.forgotPassword}
                  </button>
                  <Button
                    type="submit"
                    disabled={signin.isPending}
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {messages.auth.submitSignin}
                  </Button>
                </form>
              ) : (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={signupForm.handleSubmit((v) => signup.mutate(v))}
                >
                  <Field
                    id="signup-email"
                    label={messages.auth.email}
                    error={signupForm.formState.errors.email?.message}
                  >
                    <Input type="email" autoComplete="email" {...signupForm.register('email')} />
                  </Field>
                  <Field
                    id="signup-password"
                    label={messages.auth.password}
                    error={signupForm.formState.errors.password?.message}
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...signupForm.register('password')}
                    />
                  </Field>
                  <Field
                    id="signup-confirm"
                    label={messages.auth.confirmPassword}
                    error={signupForm.formState.errors.confirmPassword?.message}
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...signupForm.register('confirmPassword')}
                    />
                  </Field>
                  <Button
                    type="submit"
                    disabled={signup.isPending}
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {messages.auth.submitSignup}
                  </Button>
                </form>
              )}

              {googleClientId ? (
                <div className="mt-4 flex justify-center" ref={googleButtonRef} />
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactElement;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
