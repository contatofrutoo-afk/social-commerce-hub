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
  customerAvatarUrl?: string | null;
  companyLogoUrl?: string | null;
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

// --- Analytics ---

export interface PostMetric {
  id: string;
  text: string | null;
  authorType: PostAuthorType;
  authorName: string | null;
  createdAt: string;
  loveCount: number;
  dislikeCount: number;
  commentCount: number;
  photoCount: number;
  productCount: number;
  products: { id: string; name: string; ordered: number; revenue: number }[];
  orderCount: number;
  conversionRate: number;
  hourBreakdown: { hour: number; count: number }[];
  dayBreakdown: { day: string; count: number }[];
  contextBreakdown: { context: string; count: number }[];
}

export interface ProductMetric {
  id: string;
  name: string;
  category: string | null;
  price: number;
  imageUrl: string | null;
  likes: number;
  orderCount: number;
  quantitySold: number;
  revenue: number;
  customers: { id: string; name: string }[];
  interestedCustomers: { id: string; name: string }[];
  peakSaleHour: number | null;
  peakSaleDay: string | null;
  buyerProfile: { context: string; count: number }[];
  boughtTogether: { id: string; name: string; count: number }[];
}

export interface BusinessMetrics {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  recurringCustomers: number;
  newCustomersLast30d: number;
  totalCheckins: number;
  totalOrders: number;
  totalPosts: number;
  totalComments: number;
  totalPhotos: number;
  accessBySource: { source: string; count: number }[];
  visitContexts: { context: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  peakDays: { day: string; count: number }[];
  avgTicket: number;
  avgTimeBetweenVisitsHours: number | null;
  topProducts: { id: string; name: string; count: number }[];
  topCategories: { category: string; count: number }[];
}

export interface CustomerServiceProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  customerSince: string;
  visitCount: number;
  currentContext: string | null;
  recentOrders: Order[];
  favoriteProducts: { id: string; name: string; count: number }[];
  likedProducts: { id: string; name: string }[];
  wishedProducts: { id: string; name: string }[];
  favoriteCategories: { category: string; count: number }[];
  preferredHour: number | null;
  preferredDay: string | null;
  avgTimeBetweenVisitsHours: number | null;
  avgSpend: number;
  suggestions: string[];
}

export interface Insight {
  type: "alert" | "positive" | "info";
  title: string;
  description: string;
}

// --- CRM ---

export type TimelineEventType = "checkin" | "order" | "reaction_love" | "reaction_dislike" | "comment" | "like" | "wish" | "post";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  createdAt: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface ProductInteraction {
  productId: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  count: number;
}

export interface PurchaseSummary {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  biggestPurchase: number;
  lastOrder: string | null;
  mostOrderedProduct: { id: string; name: string; count: number } | null;
  mostOrderedCategory: string | null;
  boughtTogether: { id: string; name: string; count: number }[];
}

export interface VisitHabits {
  preferredHour: number | null;
  preferredDay: string | null;
  avgTimeBetweenVisitsHours: number | null;
  avgCheckinToOrderHours: number | null;
  mostUsedTable: { id: string; label: string } | null;
  mostCommonSource: string | null;
  daysSinceLastVisit: number | null;
  returnFrequency: "alta" | "media" | "baixa";
  returnFrequencyText: string;
}

export type CustomerClassification = "new" | "frequent" | "vip" | "at_risk" | "inactive";

export type TrendType = "increasing" | "stable" | "decreasing" | "inactive";

export interface EngagementSummary {
  level: "muito_ativo" | "ativo" | "pouco_ativo" | "baixo_engajamento";
  isHighlyEngaged: boolean;
  isRepeatBuyer: boolean;
  isVip: boolean;
  isInactive: boolean;
  isNew: boolean;
}

export interface CustomerInsights {
  totalVisits: number;
  firstVisit: string | null;
  lastVisit: string | null;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrder: string | null;
  purchasedProducts: ProductInteraction[];
  lovedProducts: ProductInteraction[];
  dislikedProducts: ProductInteraction[];
  likedProducts: ProductInteraction[];
  lastComment: string | null;
  visitContexts: { context: string; count: number }[];
  timeline: TimelineEvent[];

  // Identification
  name: string;
  whatsapp: string;
  avatarUrl: string | null;
  customerSince: string;

  // Behavior
  dislikeCount: number;
  loveCount: number;
  postsCount: number;
  photoCount: number;
  commentCount: number;
  wishedProducts: ProductInteraction[];
  favoriteCategories: { category: string; count: number }[];

  // Habits
  habits: VisitHabits;

  // Purchases
  purchases: PurchaseSummary;

  // Engagement
  engagement: EngagementSummary;

  // Dominant visit context
  dominantContext: string | null;

  // Suggestions
  suggestions: string[];

  // Executive summary
  executiveSummary: string;

  // Classification
  classification: CustomerClassification;
  trend: TrendType;
  lastInteractionAt: string | null;
  lastLoveAt: string | null;
  lastDislikeAt: string | null;
  lastCommentAt: string | null;
  lastPostAt: string | null;
  lastLikeAt: string | null;
  likedButNotOrdered: ProductInteraction[];
}
