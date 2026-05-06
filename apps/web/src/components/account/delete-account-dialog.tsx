'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
import { deleteAccount } from '@/lib/queries';
import messages from '@/../messages/en.json';

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const [confirmation, setConfirmation] = useState('');
  const queryClient = useQueryClient();
  const router = useRouter();
  const { refetch } = useAuth();

  const mutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      queryClient.clear();
      await refetch();
      onOpenChange(false);
      router.push('/');
      toast.success(messages.account.deleteSuccess);
    },
    onError: () => toast.error(messages.account.deleteError),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent labelledBy="delete-account-title" closeLabel={messages.auth.closeDialog}>
        <DialogHeader>
          <DialogTitle id="delete-account-title">{messages.account.deleteTitle}</DialogTitle>
          <DialogDescription>{messages.account.deleteWarning}</DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-4">
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={messages.account.deletePlaceholder}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {messages.account.deleteCancel}
            </Button>
            <Button
              type="button"
              disabled={confirmation !== 'DELETE' || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {messages.account.deleteConfirm}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
