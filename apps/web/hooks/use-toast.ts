import { toast } from "sonner";

type ToastFunction = typeof toast;

interface UseToastReturn {
  toast: ToastFunction;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  loading: (message: string) => string | number;
  dismiss: (id?: string | number) => void;
}

export function useToast(): UseToastReturn {
  const success = (message: string, description?: string) => {
    toast.success(message, {
      description,
    });
  };

  const error = (message: string, description?: string) => {
    toast.error(message, {
      description,
    });
  };

  const warning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
    });
  };

  const info = (message: string, description?: string) => {
    toast.info(message, {
      description,
    });
  };

  const loading = (message: string) => {
    return toast.loading(message);
  };

  const dismiss = (id?: string | number) => {
    toast.dismiss(id);
  };

  return {
    toast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
  };
}
