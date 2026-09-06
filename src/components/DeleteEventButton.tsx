import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Confirms, then submits the standard delete form to the events handler (progressive-enhancement friendly).
export default function DeleteEventButton({ id }: { id: number }) {
  const submit = () => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/admin/events";
    form.innerHTML = `<input type="hidden" name="_action" value="delete"><input type="hidden" name="id" value="${id}">`;
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger className={cn(buttonVariants({ variant: "destructive" }), "h-9 px-3")}>
        <Trash2 className="size-4" />
        Delete event
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this event?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the event and all of its RSVPs. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={submit}
            className={cn(buttonVariants({ variant: "destructive" }), "bg-destructive text-white hover:bg-destructive/90")}
          >
            Delete event
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
