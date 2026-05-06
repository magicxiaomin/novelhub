'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { resetPassword } from '@/lib/queries';
import messages from '@/../messages/en.json';

const schema = z
  .object({
    password: z.string().min(8, messages.auth.validationPassword),
    confirmPassword: z.string().min(8, messages.auth.validationPassword),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: messages.auth.validationConfirm,
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordClient({ token }: { token: string | null }): JSX.Element {
  const { openAuthModal } = useAuth();
  const [invalid, setInvalid] = useState(!token);
  const [success, setSuccess] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      resetPassword({ token: token ?? '', password: values.password }),
    onSuccess: () => setSuccess(true),
    onError: (err) => {
      if (err instanceof ApiError && (err.status === 400 || err.status === 410)) {
        setInvalid(true);
        return;
      }
      setInvalid(true);
    },
  });

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => openAuthModal({ mode: 'signin' }), 2_000);
    return () => window.clearTimeout(timer);
  }, [openAuthModal, success]);

  return (
    <AppShell>
      <section className="px-5 py-8">
        <h1 className="text-2xl font-bold">{messages.auth.resetPageTitle}</h1>
        {invalid ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">{messages.auth.resetMissingToken}</p>
            <Button
              type="button"
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => openAuthModal({ mode: 'signin', forgotPassword: true })}
            >
              {messages.auth.requestNewLink}
            </Button>
          </div>
        ) : success ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">{messages.auth.resetSuccess}</p>
            <Button asChild variant="outline">
              <Link href="/">{messages.auth.home}</Link>
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{messages.auth.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">{messages.auth.confirmNewPassword}</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <p className="text-xs text-red-600">
                  {form.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {messages.auth.resetSubmit}
            </Button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
