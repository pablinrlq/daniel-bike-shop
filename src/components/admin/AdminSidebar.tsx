import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Warehouse,
  Image,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Link as LinkIcon,
  Tag,
  Star,
  Wrench,
  Bot,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Produtos',
    url: '/admin/products',
    icon: Package,
  },
  {
    title: 'Categorias',
    url: '/admin/categories',
    icon: FolderTree,
  },
  {
    title: 'Estoque',
    url: '/admin/stock',
    icon: Warehouse,
  },
  {
    title: 'Pedidos',
    url: '/admin/orders',
    icon: ShoppingCart,
  },
  {
    title: 'Banners',
    url: '/admin/banners',
    icon: Image,
  },
  {
    title: 'Cupons',
    url: '/admin/coupons',
    icon: Tag,
  },
  {
    title: 'Avaliações',
    url: '/admin/reviews',
    icon: Star,
  },
  {
    title: 'Serviços',
    url: '/admin/services',
    icon: Wrench,
  },
  {
    title: 'Atendente IA',
    url: '/admin/atendente-ia',
    icon: Bot,
  },
];

const adminOnlyItems = [
  {
    title: 'Usuários',
    url: '/admin/users',
    icon: Users,
  },
  {
    title: 'Bling',
    url: '/admin/bling',
    icon: LinkIcon,
  },
  {
    title: 'Configurações',
    url: '/admin/settings',
    icon: Settings,
  },
];

const AdminSidebar: React.FC = () => {
  const { signOut, isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" />
          {!isCollapsed && (
            <span className="font-bold text-lg truncate">Admin</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && 'sr-only')}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    onClick={() => navigate(item.url)}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(isCollapsed && 'sr-only')}>
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminOnlyItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      onClick={() => navigate(item.url)}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-2">
        {!isCollapsed && user && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-3",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </Button>

        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "w-full justify-start gap-3",
              isCollapsed && "justify-center px-0"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Recolher</span>
              </>
            )}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
