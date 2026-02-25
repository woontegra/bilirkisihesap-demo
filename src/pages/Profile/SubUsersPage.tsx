import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, User } from "lucide-react";
import { useToast } from "@/context/ToastContext";

type SubUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "viewer";
};

const fakeUsers: SubUser[] = [
  { id: 1, name: "Ahmet Yılmaz", email: "ahmet@example.com", role: "admin" },
  { id: 2, name: "Ayşe Demir", email: "ayse@example.com", role: "user" },
  { id: 3, name: "Mehmet Kaya", email: "mehmet@example.com", role: "viewer" },
];

const roleLabels = {
  admin: "Admin",
  user: "Kullanıcı",
  viewer: "Görüntüleyici",
};

const roleColors = {
  admin: "bg-purple-100 text-purple-800",
  user: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-800",
};

export default function SubUsersPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState<SubUser[]>(fakeUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user" as SubUser["role"],
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // TODO: API call
    setTimeout(() => {
      const newUser: SubUser = {
        id: users.length + 1,
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      setUsers([...users, newUser]);
      setFormData({ name: "", email: "", role: "user" });
      setIsDialogOpen(false);
      setIsLoading(false);
      success("Kullanıcı eklendi");
    }, 500);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    setUsers(users.filter((u) => u.id !== id));
    success("Kullanıcı silindi");
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Alt Kullanıcılar</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ekibinizin üyelerini yönetin
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Kullanıcı Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı Ekle</DialogTitle>
              <DialogDescription>
                Yeni bir alt kullanıcı ekleyin
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ad Soyad"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as SubUser["role"],
                      })
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="user">Kullanıcı</option>
                    <option value="viewer">Görüntüleyici</option>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Ekleniyor..." : "Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı Listesi</CardTitle>
          <CardDescription>Ekibinizin tüm üyeleri</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Kullanıcı
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                    Rol
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
