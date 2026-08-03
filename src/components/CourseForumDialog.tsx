import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CourseForumThread from "@/components/CourseForumThread";

interface CourseForumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle?: string;
}

const CourseForumDialog = ({ open, onOpenChange, courseId, courseTitle }: CourseForumDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg flex flex-col max-h-[90vh] h-[70vh]">
      <DialogHeader>
        <DialogTitle>Foro del Curso</DialogTitle>
        <DialogDescription className={courseTitle ? "text-xs -mt-1" : "sr-only"}>
          {courseTitle || "Mensajes grupales de este curso"}
        </DialogDescription>
      </DialogHeader>
      <CourseForumThread courseId={courseId} />
    </DialogContent>
  </Dialog>
);

export default CourseForumDialog;
