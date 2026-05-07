'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '@/components/providers';
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
import { deleteAccount } from '@/lib/queries';
import { messages } from '@novelhub/shared';

type DeleteAccountValues = {
  password?: string;
  confirmation: string;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { refetch, user } = useAuth();
  const hasPassword = user?.hasPassword === true;
  const deleteAccountSchema = useMemo(
    () =>
      z.object({
        password: hasPassword
          ? z.string().min(8, messages.auth.validationPassword)
          : z.string().optional(),
        confirmation: z.string().refine((value) => value === 'DELETE', {
          message: messages.account.deletePlaceholder,
        }),
      }),
    [hasPassword],
  );
  const form = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: DeleteAccountValues) =>
      deleteAccount(hasPassword ? values.password : undefined),
    onSuccess: async () => {
      queryClient.clear();
      await refetch();
      form.reset();
      onOpenChange(false);
      router.push('/');
      toast.success(messages.account.deleteSuccess);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        if (hasPassword) {
          form.setError('password', { type: 'server', message: messages.account.invalidPassword });
        } else {
          toast.error(messages.account.deleteError);
        }
        return;
      }
      toast.error(messages.account.deleteError);
    },
  });

  useEffect(() => {
    if (!open) form.reset();
  }, [form, open]);

  const confirmation = form.watch('confirmation');
  const password = form.watch('password') ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.account.deleteTitle}</DialogTitle>
          <DialogDescription>{messages.account.deleteWarning}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          {hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">{messages.auth.password}</Label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password?.message ? (
                <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirmation">
              {messages.account.deletePlaceholder}
            </Label>
            <Input
              id="delete-account-confirmation"
              autoComplete="off"
              {...form.register('confirmation')}
            />
            {form.formState.errors.confirmation?.message ? (
              <p className="text-xs text-red-600">{form.formState.errors.confirmation.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {messages.account.deleteCancel}
            </Button>
            <Button
              type="submit"
              disabled={
                confirmation !== 'DELETE' ||
                (hasPassword && password.length < 8) ||
                mutation.isPending
              }
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {messages.account.deleteConfirm}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
