// Tipos de domínio da WEAZE. Repositórios devolvem estes tipos, não linhas cruas do Cloud.
export type VisitContext = "sozinho" | "casal" | "amigos" | "familia";
export type ReactionType = "love" | "dislike";
export type OrderStatus = "received" | "completed";
export type PostAuthorType = "business" | "customer";

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string;
}

export interface Table {
  id: string;
  companyId: string;
  label: string;
  slug: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  whatsapp: string;
  avatarUrl: string | null;
  firstVisitAt: string;
  lastVisitAt: string;
  visitCount: number;
}

export interface Checkin {
  id: string;
  customerId: string;
  companyId: string;
  tableId: string | null;
  context: VisitContext;
  createdAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  description: string | null;
}

export interface Post {
  id: string;
  companyId: string;
  authorType: PostAuthorType;
  customerId: string | null;
  customerName?: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  text: string | null;
  category: string | null;
  companions: VisitContext | null;
  createdAt: string;
  products: Product[];
  loveCount: number;
  dislikeCount: number;
  commentCount: number;
  myReaction: ReactionType | null;
}

export interface Comment {
  id: string;
  postId: string;
  customerId: string;
  customerName: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  companyId: string;
  customerId: string;
  customerName?: string;
  tableId: string | null;
  tableLabel?: string | null;
  status: OrderStatus;
  total: number;
  note: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  note: string | null;
  unitPrice: number;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  note?: string;
}
