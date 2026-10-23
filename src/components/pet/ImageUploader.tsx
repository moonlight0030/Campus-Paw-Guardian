import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadPetPhoto } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  userId: string;
  value: string;
  onChange: (url: string) => void;
}

export default function ImageUploader({ userId, value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error('请上传图片文件');
        return;
      }
      if (file.size > 1024 * 1024) {
        toast.error('图片大小不能超过 1MB');
        return;
      }
      setUploading(true);
      try {
        const url = await uploadPetPhoto(userId, file);
        onChange(url);
        toast.success('图片上传成功');
      } catch (e) {
        console.error(e);
        toast.error('上传失败，请重试');
      } finally {
        setUploading(false);
      }
    },
    [userId, onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploading,
  });

  if (value) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-border/60">
        <img src={value} alt="预览" className="w-full h-full object-cover" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange('')}
          className="absolute top-2 right-2 rounded-xl bg-background/80 hover:bg-background"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <>
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
          <span className="text-sm text-muted-foreground">上传中...</span>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
            <ImagePlus className="w-7 h-7 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">点击或拖拽上传萌宠照片</p>
          <p className="text-xs text-muted-foreground mt-1">支持 JPG / PNG，不超过 1MB</p>
        </>
      )}
    </div>
  );
}