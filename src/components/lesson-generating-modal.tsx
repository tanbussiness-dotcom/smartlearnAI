'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoaderCircle, CheckCircle, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Step = {
  key: string;
  label: string;
};

const steps: Step[] = [
  { key: 'sources', label: 'Đang tìm kiếm nguồn tài liệu...' },
  { key: 'synthesize', label: 'Đang tổng hợp nội dung bài học...' },
  { key: 'validate', label: 'Đang kiểm tra và xác thực bài học...' },
  { key: 'save', label: 'Đang lưu vào cơ sở dữ liệu...' },
];

type LessonGeneratingModalProps = {
  isOpen: boolean;
  currentStepKey: string;
};

export function LessonGeneratingModal({
  isOpen,
  currentStepKey,
}: LessonGeneratingModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const stepIndex = steps.findIndex((s) => s.key === currentStepKey);
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex);
    }
  }, [currentStepKey]);

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <span>Đang tạo lộ trình học...</span>
          </DialogTitle>
          <DialogDescription>
            AI đang làm việc. Quá trình này có thể mất một vài phút. Vui lòng
            không đóng cửa sổ này.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <AnimatePresence>
            {steps.map((step, index) => (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 text-sm"
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : index === currentStepIndex ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span
                  className={
                    index < currentStepIndex
                      ? 'text-muted-foreground line-through'
                      : index === currentStepIndex
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                  }
                >
                  {step.label}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
