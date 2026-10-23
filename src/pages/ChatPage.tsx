import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  sendChat,
  uploadChatImage,
  createChatSession,
  fetchChatSessions,
  fetchChatMessages,
  appendChatMessage,
  touchChatSession,
  deleteChatSession,
  type ChatSession,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  ArrowLeft, Send, PawPrint, Loader2, Plus, X, History, Trash2, MessageSquarePlus,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 用户上传的图片（本地 base64 预览），发送时一并传给 AI 分析 */
  imageUrl?: string;
}

/** 压缩本地图片为 JPEG base64（最长边 1024px），用于上传给 AI 分析 */
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('当前浏览器不支持图片处理'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

const SUGGESTIONS = [
  '校园里的流浪猫可以喂什么？',
  '发现受伤的小猫应该怎么办？',
  '怎么判断流浪狗是否亲人？',
  '冬天怎么帮助流浪猫过冬？',
];

/** 清理 AI 回复中残留的 Markdown 符号（星号、分隔线、反引号等），提升可读性 */
const cleanReply = (text: string): string =>
  text
    // 去除加粗/斜体星号与行内代码反引号，保留内容
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    // 去除行首 # 标题标记
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    // 删除独立的 -- / --- 分隔线行
    .replace(/^\s*-{2,}\s*$/gm, '')
    // 残余的成对连字符替换为中文破折号
    .replace(/-{2,}/g, '——')
    // 去除行首列表符号（- * •），保留内容
    .replace(/^\s*[-*•]\s+/gm, '')
    // 合并多余连续空行
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 新消息时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, pendingImage]);

  const openHistory = useCallback(async () => {
    if (!user) {
      toast.info('登录后可查看历史对话记录');
      return;
    }
    setHistoryOpen(true);
    setLoadingSessions(true);
    try {
      const list = await fetchChatSessions(user.id);
      setSessions(list);
    } catch (e) {
      console.error(e);
      toast.error('加载历史会话失败');
    } finally {
      setLoadingSessions(false);
    }
  }, [user]);

  const loadSession = async (id: string) => {
    setHistoryOpen(false);
    setSending(true);
    try {
      const msgs = await fetchChatMessages(id);
      setMessages(
        msgs.map((m) => ({
          role: m.role,
          content: m.role === 'assistant' ? cleanReply(m.content) : m.content,
          ...(m.image_url ? { imageUrl: m.image_url } : {}),
        }))
      );
      setSessionId(id);
    } catch (e) {
      console.error(e);
      toast.error('加载会话失败');
    } finally {
      setSending(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput('');
    setPendingImage(null);
    setHistoryOpen(false);
  };

  const removeSession = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteChatSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) newChat();
      toast.success('已删除该会话');
    } catch (e) {
      console.error(e);
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片不能超过 10MB');
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setPendingImage(dataUrl);
    } catch (e) {
      console.error(e);
      toast.error('图片处理失败，请换一张试试');
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    const image = pendingImage;
    if ((!content && !image) || sending) return;

    // 若有图片且已登录，先上传到 Storage，得到公开 URL
    let imageUrl: string | null = null;
    if (image && user) {
      try {
        const blob = await (await fetch(image)).blob();
        const file = new File([blob], 'chat.jpg', { type: blob.type || 'image/jpeg' });
        imageUrl = await uploadChatImage(user.id, file);
      } catch (e) {
        console.error(e);
        toast.error('图片上传失败，请重试');
        return;
      }
    }

    const userMsg: ChatMessage = { role: 'user', content, ...(image ? { imageUrl: image } : {}) };
    const next: ChatMessage[] = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setPendingImage(null);
    setSending(true);

    try {
      // 持久化（已登录）
      let sid = sessionId;
      if (user) {
        if (!sid) {
          const title = content || (image ? '图片健康咨询' : '新对话');
          sid = await createChatSession(user.id, title);
          setSessionId(sid);
        }
        await appendChatMessage(sid, user.id, 'user', content, imageUrl);
      }

      const reply = await sendChat(next);
      const cleaned = cleanReply(reply);
      setMessages([...next, { role: 'assistant', content: cleaned }]);

      if (user && sid) {
        await appendChatMessage(sid, user.id, 'assistant', cleaned, null);
        await touchChatSession(sid);
      }
    } catch (e) {
      console.error(e);
      toast.error('AI 暂时开小差了，请稍后重试');
      // 失败回滚：恢复输入内容与待发图片，方便重试
      setMessages(messages);
      setInput(content);
      setPendingImage(image);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)] md:h-[calc(100dvh-14rem)] min-h-[26rem]">
      {/* 顶部标题 */}
      <div className="flex items-center gap-3 shrink-0 pb-4 border-b border-border/60">
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <PawPrint className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-rounded font-bold text-foreground">智能问答</h1>
          <p className="text-xs md:text-sm text-muted-foreground truncate">
            AI 健康助手 · 校园流浪猫狗守护知识在线解答
          </p>
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl w-9 h-9"
            onClick={newChat}
            aria-label="新对话"
            title="新对话"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl w-9 h-9"
            onClick={openHistory}
            aria-label="历史会话"
            title="历史会话"
          >
            <History className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* 消息展示区 */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <PawPrint className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-rounded font-bold text-foreground">你好，我是 AI 健康助手</p>
            <p className="text-sm text-muted-foreground mt-1 text-pretty max-w-md">
              关于校园流浪猫狗的喂养、健康、救助、领养问题，都可以问我～ 也支持点下方 + 上传照片，帮你分析 TA 的健康状况
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-sm px-4 py-2 rounded-full bg-card border border-border/60 text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] md:max-w-[70%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5">
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt="用户上传的动物照片"
                        className="rounded-xl mb-2 max-h-56 w-auto max-w-full object-contain"
                      />
                    )}
                    {m.content && (
                      <p className="text-sm whitespace-pre-wrap break-words text-pretty">{m.content}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="bg-primary/10">
                      <PawPrint className="w-4 h-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[85%] md:max-w-[70%] rounded-2xl rounded-bl-md bg-card border border-border/60 px-4 py-2.5">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words text-pretty">
                      {m.content}
                    </p>
                  </div>
                </div>
              )
            )}
            {sending && (
              <div className="flex items-start gap-2.5">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    <PawPrint className="w-4 h-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-bl-md bg-card border border-border/60 px-4 py-3">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 底部输入区 */}
      <div className="shrink-0 pt-3 border-t border-border/60">
        {/* 待发送图片预览 */}
        {pendingImage && (
          <div className="flex items-center gap-3 mb-2">
            <div className="relative shrink-0">
              <img
                src={pendingImage}
                alt="待发送的图片预览"
                className="w-20 h-20 rounded-xl object-cover border border-border/60"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center shadow"
                aria-label="移除图片"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-pretty">
              已选择图片，可在输入框补充描述，发送后 AI 将先评估动物状况，再给出健康建议
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(input);
            }}
            placeholder="输入问题，或点 + 上传动物照片"
            maxLength={500}
            disabled={sending}
            className="rounded-xl flex-1 min-w-0"
          />
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl shrink-0 w-10 h-10"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="上传图片"
            title="上传图片"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => send(input)}
            disabled={sending || (!input.trim() && !pendingImage)}
            className="rounded-xl gap-1.5 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">发送</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI 回答仅供参考，遇到紧急健康问题请及时联系宠物医院
        </p>
      </div>

      {/* 历史会话抽屉 */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
            <SheetTitle className="text-left">历史会话</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {loadingSessions ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p>暂无历史会话</p>
                <p className="text-xs mt-1">开始一次对话后，记录会自动保存到这里</p>
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    sessionId === s.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(s.updated_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 w-8 h-8 md:opacity-0 md:group-hover:opacity-100"
                    disabled={deletingId === s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(s.id);
                    }}
                    aria-label="删除会话"
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}