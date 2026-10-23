import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

export const BAIDU_MAP_AK = 'OeTpXHgdUrRT2pPyAPRL7pog6GlMlQzl';

interface MapProps {
  center?: { lng: number; lat: number };
  zoom?: number;
  className?: string;
  onMapLoaded?: (map: any, BMapGL: any) => void;
  enableScrollWheelZoom?: boolean;
}

let mapScriptPromise: Promise<any> | null = null;

export function loadBaiduMapGL(ak: string = BAIDU_MAP_AK): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).BMapGL) {
    return Promise.resolve((window as any).BMapGL);
  }

  if (mapScriptPromise) {
    return mapScriptPromise;
  }

  mapScriptPromise = new Promise((resolve, reject) => {
    const callbackName = `__initBaiduMapGL_${Date.now()}`;
    (window as any)[callbackName] = () => {
      resolve((window as any).BMapGL);
      delete (window as any)[callbackName];
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${ak}&callback=${callbackName}`;
    script.onerror = (e) => {
      mapScriptPromise = null;
      reject(new Error('百度地图加载失败，请检查网络或AK配置'));
    };
    document.head.appendChild(script);
  });

  return mapScriptPromise;
}

export default function Map({
  center = { lng: 116.3275, lat: 39.9905 },
  zoom = 16,
  className = 'w-full h-full min-h-[400px]',
  onMapLoaded,
  enableScrollWheelZoom = true,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    loadBaiduMapGL()
      .then((BMapGL) => {
        if (!isMounted || !containerRef.current) return;

        // 如果已存在实例，先销毁
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.destroy();
          } catch (e) {
            // ignore
          }
        }

        const map = new BMapGL.Map(containerRef.current);
        const point = new BMapGL.Point(center.lng, center.lat);
        map.centerAndZoom(point, zoom);

        if (enableScrollWheelZoom) {
          map.enableScrollWheelZoom(true);
        }

        // 添加控件
        try {
          const scaleCtrl = new BMapGL.ScaleControl();
          const zoomCtrl = new BMapGL.ZoomControl();
          map.addControl(scaleCtrl);
          map.addControl(zoomCtrl);
        } catch (e) {
          // ignore
        }

        mapInstanceRef.current = map;
        setLoading(false);

        if (onMapLoaded) {
          onMapLoaded(map, BMapGL);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('地图加载失败:', err);
        setLoadError(err.message || '地图初始化失败');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (e) {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-muted/40 ${className}`}>
      <div ref={containerRef} className="w-full h-full min-h-[inherit]" />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">正在加载校园地图...</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 p-6 text-center z-10">
          <MapPin className="w-10 h-10 text-destructive mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">地图加载异常</p>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">{loadError}</p>
        </div>
      )}
    </div>
  );
}
