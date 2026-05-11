import { Link } from 'react-router-dom';
import { LogIn, ShieldAlert, Home } from 'lucide-react';
import { useCloudServiceStore } from '@shuoshuo-player/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RequireCloudAdminProps {
  children: React.ReactNode;
}

// 子页面权限保护：未登录或非管理员时显示提示卡，不再强制 Navigate 离开
// （把权限决定从路由层下沉到页面层，配合"水晶蟹小屋"开放式着陆页设计）
export function RequireCloudAdmin({ children }: RequireCloudAdminProps) {
  const isLogin = useCloudServiceStore((s) => s.isLogin());
  const isAdmin = useCloudServiceStore((s) => s.isAdmin());

  if (!isLogin) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              请先登录
            </CardTitle>
            <CardDescription>
              本功能需要登录水晶蟹小屋的管理员账号才能使用。请回到首页登录后再试。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/cloud-services">
                <Home className="mr-1 h-4 w-4" />
                回到水晶蟹小屋首页
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription>
              本功能仅限水晶蟹小屋管理员使用。如需访问，请联系管理员授予对应角色。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/cloud-services">
                <Home className="mr-1 h-4 w-4" />
                回到水晶蟹小屋首页
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
