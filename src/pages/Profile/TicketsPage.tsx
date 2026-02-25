import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { MessageSquare, Plus, Send, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/utils/apiClient";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface TicketReply {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Ticket {
  id: number;
  tenantId: number;
  userId: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  replies: TicketReply[];
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    priority: "medium" as TicketPriority,
  });
  const [replyMessage, setReplyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tenantId = useMemo(() => Number(localStorage.getItem("tenant_id") || "1"), []);
  const userId = useMemo(() => user?.id || Number(localStorage.getItem("user_id") || "0"), [user]);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/tickets`, {
        headers: {
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error("Ticketlar yüklenemedi");
      }

      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      error("Destek talepleri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      error("Konu ve açıklama zorunludur");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newTicket),
      });

      if (!res.ok) {
        throw new Error("Ticket oluşturulamadı");
      }

      success("Destek talebi başarıyla oluşturuldu");
      setNewTicket({ subject: "", description: "", priority: "medium" });
      setShowNewTicketForm(false);
      await loadTickets();
    } catch (err) {
      console.error("Failed to create ticket:", err);
      error("Destek talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (ticketId: number) => {
    if (!replyMessage.trim()) {
      error("Mesaj zorunludur");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: replyMessage }),
      });

      if (!res.ok) {
        throw new Error("Yanıt eklenemedi");
      }

      success("Yanıt başarıyla eklendi");
      setReplyMessage("");
      const updatedTicket = await res.json();
      setSelectedTicket(updatedTicket);
      await loadTickets();
    } catch (err) {
      console.error("Failed to add reply:", err);
      error("Yanıt eklenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ticketId: number, status: TicketStatus) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": String(tenantId),
          "x-user-id": String(userId),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Ticket güncellenemedi");
      }

      success("Durum güncellendi");
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        const updatedTicket = await res.json();
        setSelectedTicket(updatedTicket);
      }
    } catch (err) {
      console.error("Failed to update ticket:", err);
      error("Durum güncellenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case "open":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "in_progress":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "closed":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: TicketStatus) => {
    const labels: Record<TicketStatus, string> = {
      open: "Açık",
      in_progress: "İşlemde",
      resolved: "Çözüldü",
      closed: "Kapalı",
    };
    return labels[status] || status;
  };

  const getPriorityLabel = (priority: TicketPriority) => {
    const labels: Record<TicketPriority, string> = {
      low: "Düşük",
      medium: "Orta",
      high: "Yüksek",
      urgent: "Acil",
    };
    return labels[priority] || priority;
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colors: Record<TicketPriority, string> = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return colors[priority] || "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Destek Talepleri</h2>
          <p className="text-sm text-gray-500 mt-1">Destek taleplerinizi buradan yönetebilirsiniz</p>
        </div>
        <Button
          onClick={() => setShowNewTicketForm(!showNewTicketForm)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Yeni Talep
        </Button>
      </div>

      {/* New Ticket Form */}
      {showNewTicketForm && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni Destek Talebi</CardTitle>
            <CardDescription>Yardıma ihtiyacınız mı var? Bize ulaşın</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Konu *</Label>
              <Input
                id="subject"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Örn: Hesaplama hatası"
              />
            </div>
            <div>
              <Label htmlFor="priority">Öncelik</Label>
              <Select
                id="priority"
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as TicketPriority })}
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Açıklama *</Label>
              <Textarea
                id="description"
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Sorununuzu detaylı bir şekilde açıklayın..."
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTicket} disabled={submitting}>
                {submitting ? "Gönderiliyor..." : "Gönder"}
              </Button>
              <Button variant="outline" onClick={() => setShowNewTicketForm(false)}>
                İptal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      {loading ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            Yükleniyor...
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Henüz destek talebiniz yok.</p>
            <p className="text-sm mt-2">Yeni bir talep oluşturmak için yukarıdaki "Yeni Talep" butonuna tıklayın.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Konu
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarih ve Saat
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Öncelik
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        İşlemler
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tickets.map((ticket) => {
                      const responseStatus = ticket.status === "closed" 
                        ? "Kapatıldı" 
                        : ticket.replies.length > 0 
                        ? "Yanıtlandı" 
                        : "Cevap Bekliyor";
                      const responseStatusColor = ticket.status === "closed"
                        ? "bg-gray-100 text-gray-800"
                        : ticket.replies.length > 0
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800";

                      return (
                        <tr
                          key={ticket.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <div className="text-sm font-medium text-gray-900">
                                {ticket.subject}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                                {ticket.description}
                              </div>
                              {ticket.replies.length > 0 && (
                                <div className="text-xs text-blue-600 mt-1">
                                  {ticket.replies.length} yanıt
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(ticket.createdAt).toLocaleString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn("px-2 py-0.5 text-xs", getPriorityColor(ticket.priority))}>
                              {getPriorityLabel(ticket.priority)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                {getStatusIcon(ticket.status)}
                                <span className="text-xs text-gray-700">
                                  {getStatusLabel(ticket.status)}
                                </span>
                              </div>
                              <Badge className={cn("px-2 py-0.5 text-xs", responseStatusColor)}>
                                {responseStatus}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedTicket(ticket)}
                              className="text-xs"
                            >
                              Detay
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Detail Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2">{selectedTicket.subject}</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          {getStatusIcon(selectedTicket.status)}
                          {getStatusLabel(selectedTicket.status)}
                        </span>
                        <span className={cn("px-2 py-1 rounded-full text-xs", getPriorityColor(selectedTicket.priority))}>
                          {getPriorityLabel(selectedTicket.priority)}
                        </span>
                        <span>
                          {new Date(selectedTicket.createdAt).toLocaleString("tr-TR")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTicket.status !== "closed" && (
                        <Select
                          value={selectedTicket.status}
                          onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value as TicketStatus)}
                          className="w-32"
                        >
                          <option value="open">Açık</option>
                          <option value="in_progress">İşlemde</option>
                          <option value="resolved">Çözüldü</option>
                          <option value="closed">Kapalı</option>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTicket(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Açıklama</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  {/* Replies */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4">Yanıtlar ({selectedTicket.replies.length})</h4>
                    <div className="space-y-4">
                      {selectedTicket.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className={cn(
                            "p-3 rounded-lg",
                            reply.isAdmin ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {reply.isAdmin ? "Destek Ekibi" : selectedTicket.user.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(reply.createdAt).toLocaleString("tr-TR")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reply Form */}
                  {selectedTicket.status !== "closed" && (
                    <div className="border-t pt-4">
                      <Label htmlFor="reply">Yanıt Ekle</Label>
                      <Textarea
                        id="reply"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Yanıtınızı yazın..."
                        rows={4}
                        className="mt-2"
                      />
                      <Button
                        onClick={() => handleAddReply(selectedTicket.id)}
                        disabled={submitting || !replyMessage.trim()}
                        className="mt-2 flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? "Gönderiliyor..." : "Gönder"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

