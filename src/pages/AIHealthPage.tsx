import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, HeartPulse, ShieldPlus, Utensils, AlertTriangle, Sparkles, Cat, Dog, MessageCircle,
} from 'lucide-react';

interface QuickQuestion {
  q: string;
  a: string;
}

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    q: '发现受伤的流浪猫狗怎么办？',
    a: '首先保持距离，避免惊吓到 TA。观察伤情：若只是轻微擦伤，可联系校园动物保护社团协助；若伤势较重或出血不止，请尽快联系当地宠物医院或拨打 12345 寻求帮助。切勿强行抱起，以免造成二次伤害。',
  },
  {
    q: '可以给流浪猫狗喂什么食物？',
    a: '推荐喂食猫粮/狗粮、煮熟的鸡胸肉（不加调味）或清水。避免喂食巧克力、洋葱、葡萄、牛奶（多数猫狗乳糖不耐受）、剩饭菜（盐分过高）。喂食后请清理残余，保持环境卫生。',
  },
  {
    q: '如何判断 TA 是否需要绝育？',
    a: '如果发现 TA 未做绝育标记（如剪耳），且处于发情期（频繁叫唤、标记领地、食欲下降），建议联系动物保护组织安排 TNR（抓捕-绝育-放归）。绝育有助于控制流浪数量，也能降低患病风险。',
  },
  {
    q: '遇到特别亲人的流浪猫狗可以收养吗？',
    a: '可以先观察 TA 是否有主人（如佩戴项圈）。若确认是流浪且亲人，可先带到医院体检、驱虫、打疫苗，再考虑领养。领养前请确保自己有足够的时间、空间和经济能力长期照顾。',
  },
  {
    q: '冬天如何帮助校园流浪动物？',
    a: '可以在避风处放置纸箱+旧衣物作为简易猫窝，提供温水（防止结冰）和食物。避免使用易燃材料靠近暖气。若发现 TA 冻伤或虚弱，请及时联系救助组织。',
  },
];

const TIPS = [
  { icon: Utensils, title: '科学喂养', desc: '定时定量，避免剩饭剩菜，保持喂食点清洁。' },
  { icon: HeartPulse, title: '关注健康', desc: '留意 TA 的精神状态、毛发和食欲，异常及时求助。' },
  { icon: ShieldPlus, title: 'TNR 绝育', desc: '支持抓捕-绝育-放归，从源头控制流浪数量。' },
  { icon: Sparkles, title: '温柔相处', desc: '不追逐、不惊吓，用耐心建立信任。' },
];

const WARNING = [
  '切勿喂食巧克力、洋葱、葡萄、木糖醇等对宠物有毒的食物。',
  '不要随意给流浪动物喂人用药物，用药需遵医嘱。',
  '接触流浪动物后请及时洗手，注意个人卫生。',
  '遇到有攻击性或疑似患病的动物，请保持安全距离并联系专业人员。',
];

export default function AIHealthPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<QuickQuestion | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-rounded font-bold text-foreground">AI 健康助手</h1>
          <p className="text-muted-foreground mt-1">校园流浪动物健康知识与守护指南</p>
        </div>
        <Button onClick={() => navigate('/ai-chat')} className="rounded-xl gap-1.5 shrink-0 md:self-start">
          <MessageCircle className="w-4 h-4" />
          智能问答
        </Button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent p-6 md:p-8">
        <div className="absolute -right-6 -bottom-6 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-rounded font-bold text-white text-balance">守护从了解开始</h2>
            <p className="text-white/90 mt-1.5 text-sm text-pretty">
              这里整理了校园流浪猫狗的常见健康问题与守护建议，帮助你科学、安全地关爱身边的小生命。
            </p>
          </div>
        </div>
      </div>

      {/* 守护小贴士 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {TIPS.map((tip) => (
          <div key={tip.title} className="rounded-2xl bg-card border border-border/60 p-4">
            <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <tip.icon className="w-5 h-5 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm">{tip.title}</p>
            <p className="text-xs text-muted-foreground mt-1 text-pretty">{tip.desc}</p>
          </div>
        ))}
      </div>

      {/* 常见问题 */}
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg font-rounded flex items-center gap-2">
            <Cat className="w-5 h-5 text-primary" />
            常见问题速答
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-5">
            {QUICK_QUESTIONS.map((item, i) => (
              <Button
                key={i}
                variant={active === item ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActive(active === item ? null : item)}
                className="rounded-xl text-xs md:text-sm"
              >
                {item.q}
              </Button>
            ))}
          </div>

          {active && (
            <div className="rounded-2xl bg-secondary/50 p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Dog className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">{active.q}</p>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed text-pretty">{active.a}</p>
            </div>
          )}

          <Accordion type="single" collapsible className="mt-4">
            {QUICK_QUESTIONS.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-sm text-left hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed text-pretty">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Card className="rounded-3xl border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-lg font-rounded flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            安全注意事项
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {WARNING.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <Badge className="rounded-full bg-destructive/15 text-destructive border-0 shrink-0 mt-0.5">!</Badge>
                <span className="text-pretty">{w}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        以上内容为通用科普建议，具体健康问题请咨询专业宠物医生。
      </p>
    </div>
  );
}