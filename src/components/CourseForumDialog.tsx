import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CourseForumThread from "@/components/CourseForumThread";
import ModalidadBadge from "@/components/ModalidadBadge";

interface CourseForumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle?: string;
  courseModalidad?: string | null;
}

const CourseForumDialog = ({ open, onOpenChange, courseId, courseTitle, courseModalidad }: CourseForumDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg flex flex-col max-h-[90vh] h-[70vh]">
      <DialogHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <DialogTitle>Foro del Curso</DialogTitle>
          {courseModalidad && <ModalidadBadge modalidad={courseModalidad} />}
        </div>
        <DialogDescription className={courseTitle ? "text-xs -mt-1" : "sr-only"}>
          {courseTitle || "Mensajes grupales de este curso"}
        </DialogDescription>
      </DialogHeader>
      <CourseForumThread courseId={courseId} />
    </DialogContent>
  </Dialog>
);

export default CourseForumDialog;
