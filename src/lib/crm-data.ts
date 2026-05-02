export type ModuleKey = "dashboard" | "leads" | "customers" | "products" | "quotes" | "invoices" | "access" | "reports" | "pipelines" | "calendar" | "settings";

export type Stage = {
  id: string;
  name: string;
  color: string;
};

export type Pipeline = {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
};

export type TeamMember = {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  role: string;
  modules: ModuleKey[];
  active: boolean;
};

export type Task = {
  id: string;
  title: string;
  due: string;
  status: "Open" | "Done";
};

export type Note = {
  id: string;
  body: string;
  createdAt: string;
};

export type MailMessage = {
  id: string;
  subject: string;
  body: string;
  direction: "In" | "Out";
  createdAt: string;
};

export type ProposalElementType =
  | "heading"
  | "paragraph"
  | "text"
  | "client"
  | "amount"
  | "table"
  | "product"
  | "signature"
  | "image"
  | "rect"
  | "circle"
  | "line";

export type ProposalElement = {
  id: string;
  type: ProposalElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fill: string;
  stroke: string;
  color: string;
  fontSize: number;
  imageUrl?: string;
  productId?: string;
};

export type ProposalPageData = {
  id: string;
  elements: ProposalElement[];
};

export type ProposalDocument = {
  elements: ProposalElement[];
  pages?: ProposalPageData[];
  updatedAt: string;
};

export type Lead = {
  id: string;
  title: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  source: string;
  pipelineId: string;
  stageId: string;
  amount: number;
  probability: number;
  assignedTo: string;
  priority: "Hot" | "Warm" | "Cold";
  nextAction: string;
  tasks: Task[];
  notes: Note[];
  mails: MailMessage[];
  customFields?: CustomField[];
  communicationPreferences?: CommunicationPreferences;
  proposal?: ProposalDocument;
};

export type CustomField = {
  id: string;
  label: string;
  value: string;
};

export type CommunicationPreferences = {
  dndAllChannels: boolean;
  email: boolean;
  textMessages: boolean;
  callsAndVoicemail: boolean;
  inboundCallsAndSms: boolean;
};

export type Invoice = {
  id: string;
  client: string;
  amount: number;
  status: "Paid" | "Sent" | "Overdue" | "Draft";
  issueDate?: string;
  due: string;
  owner: string;
  leadId?: string;
  billToEmail?: string;
  taxRate?: number;
  paidAmount?: number;
  notes?: string;
  lineItems?: InvoiceLineItem[];
};

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

export type ProductCategory = "Aircon" | "Solar" | "Inverter" | "Heat Pump" | "Solar Battery";

export type Product = {
  id: string;
  category: ProductCategory;
  productClass?: string;
  productName: string;
  brandName: string;
  model?: string;
  productType?: string;
  productConfiguration?: string;
  productUnitMount?: string;
  gemsClass?: string;
  heatingCapacity?: string;
  coolingCapacity?: string;
  aeER?: string;
  acop?: string;
  gemsHspfMixed?: string;
  gemsTcspfCold?: string;
  gemsTcspfMixed?: string;
  refrigerant?: string;
  status?: string;
  imageUrl: string;
  description: string;
  price: number;
};

export type QuoteLineItem = {
  id: string;
  role: "Outdoor Unit" | "Indoor Head" | "Accessory" | "Install";
  productId?: string;
  model: string;
  brand: string;
  area: string;
  areaM2?: number;
  recommendedHeatingOutput?: string;
  quantity: number;
  productPrice: number;
  installPrice: number;
  certificates: number;
  notes: string;
};

export type QuoteRecord = {
  id: string;
  customerId: string;
  description: string;
  scheme: string;
  activityDate: string;
  priceTier: string;
  installationCostTier: string;
  items: QuoteLineItem[];
  additionalServices: QuoteLineItem[];
  certificateRate: number;
  minimumContributionAdjustment: number;
  gstRate: number;
  status: "Draft" | "Saved";
  proposalSentAt?: string;
  proposalSentBy?: string;
  proposalOpenedAt?: string;
  proposalOpenCount?: number;
  proposalChangeRequestHtml?: string;
  proposalChangeRequestedAt?: string;
  customerSignatureDataUrl?: string;
  customerSignedAt?: string;
};

export type Customer = {
  id: string;
  customerType?: "Business" | "Residential" | "Parent";
  parent?: string;
  businessName?: string;
  description?: string;
  buildingName?: string;
  unitType?: string;
  unitNumber?: string;
  levelType?: string;
  levelNumber?: string;
  streetNumber?: string;
  streetName?: string;
  streetType?: string;
  streetSuffix?: string;
  suburb?: string;
  stateName?: string;
  postcode?: string;
  rating?: string;
  salesSource?: string;
  leadGenerator?: string;
  salesAgent?: string;
  agent?: string;
  secondSalesAgent?: string;
  abn?: string;
  industryType?: string;
  paymentTermsValue?: string;
  paymentTermsUnit?: string;
  creditLimit?: string;
  contactType?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  mobile?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  wantedProduct: string;
  leadId?: string;
};

export type Appointment = {
  id: string;
  leadId: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  meetingType: "Zoom" | "Google Meet" | "Phone" | "Office";
  meetingLink: string;
  notes: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  emailStatus: "Not sent" | "Sent" | "Failed";
};

export type MailjetSettings = {
  apiKey: string;
  apiSecret: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
};

export type TwilioSettings = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  agentNumber: string;
  enabled: boolean;
};

export type CrmSettings = {
  mailjet: MailjetSettings;
  twilio: TwilioSettings;
  loginImageUrl: string;
  logoUrl: string;
};

export type CrmState = {
  pipelines: Pipeline[];
  leads: Lead[];
  customers: Customer[];
  products: Product[];
  quotes: QuoteRecord[];
  team: TeamMember[];
  invoices: Invoice[];
  appointments: Appointment[];
  settings: CrmSettings;
};

export const moduleLabels: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  customers: "Customers",
  products: "Products",
  quotes: "Quotes",
  invoices: "Invoices",
  access: "Access",
  reports: "Reports",
  pipelines: "Pipelines",
  calendar: "Calendar",
  settings: "Settings",
};

export const initialCrmState: CrmState = {
  pipelines: [
    {
      id: "sales",
      name: "Lead Sales Pipeline",
      description: "Default sales flow for new opportunities.",
      stages: [
        { id: "new", name: "New Lead", color: "bg-sky-500" },
        { id: "discussion", name: "In Discussion", color: "bg-amber-500" },
        { id: "proposal", name: "Proposal", color: "bg-violet-500" },
        { id: "closed", name: "Closed Won", color: "bg-emerald-500" },
      ],
    },
    {
      id: "solar",
      name: "Solar Installation",
      description: "Solar site survey, quote, approval, and install tracking.",
      stages: [
        { id: "site", name: "Site Survey", color: "bg-cyan-500" },
        { id: "quote", name: "Quote Sent", color: "bg-indigo-500" },
        { id: "approval", name: "Approval", color: "bg-rose-500" },
        { id: "install", name: "Installation", color: "bg-lime-500" },
      ],
    },
  ],
  team: [
    {
      id: "admin",
      email: "admin@saveplanet.local",
      name: "Aarav Admin",
      role: "Admin",
      modules: ["dashboard", "leads", "customers", "products", "quotes", "invoices", "access", "reports", "pipelines", "calendar", "settings"],
      active: true,
    },
    {
      id: "meera",
      email: "meera@saveplanet.local",
      name: "Meera Sales",
      role: "Sales Agent",
      modules: ["dashboard", "leads", "customers", "products", "quotes", "reports"],
      active: true,
    },
    {
      id: "ravi",
      email: "ravi@saveplanet.local",
      name: "Ravi Accounts",
      role: "Accounts",
      modules: ["dashboard", "invoices", "reports"],
      active: true,
    },
    {
      id: "isha",
      email: "isha@saveplanet.local",
      name: "Isha Support",
      role: "Lead Coordinator",
      modules: ["dashboard", "leads"],
      active: true,
    },
  ],
  products: [],
  quotes: [],
  customers: [
    {
      id: "C-1001",
      customerType: "Business",
      businessName: "Green Orbit Foods",
      buildingName: "Green Orbit Foods office",
      salesAgent: "Aarav Admin",
      contactType: "Primary",
      firstName: "Nikhil",
      lastName: "Sharma",
      name: "Nikhil Sharma",
      email: "nikhil@greenorbit.example",
      phone: "+91 98765 11220",
      address: "Green Orbit Foods office",
      wantedProduct: "6.6 kW rooftop solar package",
      leadId: "L-1001",
    },
  ],
  leads: [
    {
      id: "L-1001",
      title: "25 kW rooftop solar",
      company: "Green Orbit Foods",
      contact: "Nikhil Sharma",
      email: "nikhil@greenorbit.example",
      phone: "+91 98765 11220",
      source: "Website",
      pipelineId: "sales",
      stageId: "new",
      amount: 820000,
      probability: 35,
      assignedTo: "meera",
      priority: "Hot",
      nextAction: "Call finance head today",
      tasks: [{ id: "T-1", title: "Prepare ROI sheet", due: "Today", status: "Open" }],
      notes: [{ id: "N-1", body: "Asked for maintenance proposal with AMC split.", createdAt: "Apr 28" }],
      mails: [
        {
          id: "M-1",
          subject: "ROI sheet request",
          body: "Asked for ROI sheet and maintenance proposal.",
          direction: "In",
          createdAt: "Apr 28",
        },
      ],
      customFields: [{ id: "CF-1", label: "Preferred product", value: "Rooftop solar" }],
      communicationPreferences: defaultCommunicationPreferences(),
    },
    {
      id: "L-1002",
      title: "Warehouse energy audit",
      company: "Northline Logistics",
      contact: "Priya Menon",
      email: "priya@northline.example",
      phone: "+91 99887 77110",
      source: "Referral",
      pipelineId: "sales",
      stageId: "discussion",
      amount: 265000,
      probability: 55,
      assignedTo: "isha",
      priority: "Warm",
      nextAction: "Share revised scope",
      tasks: [{ id: "T-2", title: "Revise audit scope", due: "Tomorrow", status: "Open" }],
      notes: [{ id: "N-2", body: "Client wants split billing for audit and implementation.", createdAt: "Apr 27" }],
      mails: [
        {
          id: "M-2",
          subject: "Billing split",
          body: "Client wants split billing for audit and implementation.",
          direction: "In",
          createdAt: "Apr 27",
        },
      ],
      customFields: [{ id: "CF-2", label: "Billing preference", value: "Split invoice" }],
      communicationPreferences: defaultCommunicationPreferences(),
    },
    {
      id: "L-1003",
      title: "Commercial EV charger setup",
      company: "Urban Nest Mall",
      contact: "Arman Khan",
      email: "arman@urbannest.example",
      phone: "+91 90909 34343",
      source: "Campaign",
      pipelineId: "sales",
      stageId: "proposal",
      amount: 1240000,
      probability: 72,
      assignedTo: "meera",
      priority: "Hot",
      nextAction: "Send proposal with financing option",
      tasks: [{ id: "T-3", title: "Add financing option", due: "Friday", status: "Open" }],
      notes: [{ id: "N-3", body: "Requested a branded proposal by Friday.", createdAt: "Apr 26" }],
      mails: [
        {
          id: "M-3",
          subject: "Proposal timeline",
          body: "Requested a branded proposal by Friday.",
          direction: "In",
          createdAt: "Apr 26",
        },
      ],
      customFields: [{ id: "CF-3", label: "Financing required", value: "Yes" }],
      communicationPreferences: defaultCommunicationPreferences(),
    },
    {
      id: "L-1004",
      title: "Housing society solar retrofit",
      company: "Lotus Residency",
      contact: "Kavita Rao",
      email: "kavita@lotus.example",
      phone: "+91 91234 88772",
      source: "Walk-in",
      pipelineId: "solar",
      stageId: "site",
      amount: 1880000,
      probability: 42,
      assignedTo: "isha",
      priority: "Warm",
      nextAction: "Schedule site visit",
      tasks: [{ id: "T-4", title: "Book site visit", due: "May 02", status: "Open" }],
      notes: [{ id: "N-4", body: "Asked for list of documents needed before survey.", createdAt: "Apr 25" }],
      mails: [
        {
          id: "M-4",
          subject: "Survey documents",
          body: "Asked for list of documents needed before survey.",
          direction: "In",
          createdAt: "Apr 25",
        },
      ],
      customFields: [{ id: "CF-4", label: "Site visit window", value: "Morning" }],
      communicationPreferences: defaultCommunicationPreferences(),
    },
  ],
  invoices: [
    {
      id: "INV-0241",
      client: "Green Orbit Foods",
      amount: 180000,
      status: "Sent",
      issueDate: "Apr 28",
      due: "May 06",
      owner: "Ravi Accounts",
      billToEmail: "nikhil@greenorbit.example",
      taxRate: 18,
      paidAmount: 0,
      notes: "Advance invoice for rooftop solar consultation.",
      lineItems: [{ id: "LI-1", description: "Rooftop solar consultation advance", quantity: 1, rate: 180000 }],
    },
    {
      id: "INV-0238",
      client: "Urban Nest Mall",
      amount: 420000,
      status: "Paid",
      issueDate: "Apr 12",
      due: "Apr 22",
      owner: "Ravi Accounts",
      billToEmail: "arman@urbannest.example",
      taxRate: 18,
      paidAmount: 420000,
      notes: "Paid against EV charger project milestone.",
      lineItems: [{ id: "LI-2", description: "EV charger milestone billing", quantity: 1, rate: 420000 }],
    },
    {
      id: "INV-0232",
      client: "Lotus Residency",
      amount: 95000,
      status: "Overdue",
      issueDate: "Apr 08",
      due: "Apr 18",
      owner: "Ravi Accounts",
      billToEmail: "kavita@lotus.example",
      taxRate: 18,
      paidAmount: 0,
      notes: "Site survey billing pending.",
      lineItems: [{ id: "LI-3", description: "Housing society site survey", quantity: 1, rate: 95000 }],
    },
  ],
  appointments: [
    {
      id: "APT-1001",
      leadId: "L-1003",
      title: "Proposal review call",
      date: "2026-05-01",
      time: "11:00",
      duration: "45",
      meetingType: "Google Meet",
      meetingLink: "https://meet.google.com/demo-call",
      notes: "Review financing option and timeline.",
      status: "Scheduled",
      emailStatus: "Not sent",
    },
  ],
  settings: {
    loginImageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
    logoUrl: "",
    mailjet: {
      apiKey: "",
      apiSecret: "",
      fromEmail: "",
      fromName: "SavePlanet CRM",
      enabled: false,
    },
    twilio: {
      accountSid: "",
      authToken: "",
      fromNumber: "",
      agentNumber: "",
      enabled: false,
    },
  },
};

export function defaultCommunicationPreferences(): CommunicationPreferences {
  return {
    dndAllChannels: true,
    email: false,
    textMessages: false,
    callsAndVoicemail: false,
    inboundCallsAndSms: false,
  };
}

export function currency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

export function invoiceSubtotal(invoice: Invoice) {
  if (!invoice.lineItems?.length) {
    return invoice.amount;
  }
  return invoice.lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
}

export function invoiceTax(invoice: Invoice) {
  return Math.round(invoiceSubtotal(invoice) * ((invoice.taxRate ?? 0) / 100));
}

export function invoiceTotal(invoice: Invoice) {
  return invoiceSubtotal(invoice) + invoiceTax(invoice);
}

export function invoiceBalance(invoice: Invoice) {
  return Math.max(0, invoiceTotal(invoice) - (invoice.paidAmount ?? 0));
}
