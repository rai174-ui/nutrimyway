--
-- PostgreSQL database dump
--

\restrict gcHQMg7gLu1kwdeL9GVnXE4tw9NyQ1PM82tlcT426EwJoU5iLeeEhafJZcOTAHl

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batch_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_adjustments (
    id integer NOT NULL,
    batch_id integer NOT NULL,
    qty_change numeric(10,3) NOT NULL,
    note text,
    adjusted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_adjustments_id_seq OWNED BY public.batch_adjustments.id;


--
-- Name: batch_consumption_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_consumption_logs (
    id integer NOT NULL,
    batch_id integer NOT NULL,
    quantity real NOT NULL,
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_consumption_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_consumption_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_consumption_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_consumption_logs_id_seq OWNED BY public.batch_consumption_logs.id;


--
-- Name: bom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_items (
    id integer NOT NULL,
    plan_name text,
    food_item text NOT NULL,
    quantity_g real,
    calories_kcal real,
    protein_g real,
    carbs_g real,
    fat_g real
);


--
-- Name: bom_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bom_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bom_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bom_items_id_seq OWNED BY public.bom_items.id;


--
-- Name: center_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.center_auth (
    center_id text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    valid_until date
);


--
-- Name: center_broadcast_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.center_broadcast_schedules (
    id integer NOT NULL,
    center_id text NOT NULL,
    message text NOT NULL,
    schedule_time text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: center_broadcast_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.center_broadcast_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: center_broadcast_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.center_broadcast_schedules_id_seq OWNED BY public.center_broadcast_schedules.id;


--
-- Name: center_broadcast_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.center_broadcast_settings (
    center_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    retention_days integer DEFAULT 7 NOT NULL
);


--
-- Name: center_flavours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.center_flavours (
    id integer NOT NULL,
    center_id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    serving_qty real DEFAULT 1 NOT NULL,
    available_days text DEFAULT 'all'::text NOT NULL
);


--
-- Name: center_flavours_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.center_flavours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: center_flavours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.center_flavours_id_seq OWNED BY public.center_flavours.id;


--
-- Name: centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.centers (
    id text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    auto_checkout_min integer DEFAULT 180 NOT NULL,
    photo_retention_days integer DEFAULT 2
);


--
-- Name: consumption_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumption_logs (
    id integer NOT NULL,
    member_id integer,
    logged_at timestamp with time zone DEFAULT now() NOT NULL,
    meal_slot text,
    food_item text NOT NULL,
    quantity_g real,
    calories_kcal real,
    protein_g real,
    carbs_g real,
    fat_g real,
    menu_item_id integer,
    selected_flavour text,
    checkin_id integer,
    photo_url text,
    photo_uploaded_at timestamp with time zone
);


--
-- Name: consumption_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.consumption_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consumption_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.consumption_logs_id_seq OWNED BY public.consumption_logs.id;


--
-- Name: health_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.health_records (
    id integer NOT NULL,
    member_id integer,
    center_id text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    weight_kg real,
    bmi real,
    resting_hr integer,
    notes text,
    body_fat_pct real,
    visceral_fat real,
    bmr real,
    metabolic_age integer,
    muscle_mass_kg real
);


--
-- Name: health_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.health_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: health_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.health_records_id_seq OWNED BY public.health_records.id;


--
-- Name: ingredient_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredient_batches (
    id integer NOT NULL,
    ingredient_id integer NOT NULL,
    center_id text NOT NULL,
    batch_number text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    opened_at timestamp with time zone,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_member_id integer,
    assigned_member_name text,
    received_qty real,
    received_unit text,
    CONSTRAINT ingredient_batches_status_check CHECK ((status = ANY (ARRAY['new'::text, 'open'::text, 'consumed'::text])))
);


--
-- Name: ingredient_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredient_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredient_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredient_batches_id_seq OWNED BY public.ingredient_batches.id;


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id integer NOT NULL,
    name text NOT NULL,
    pack_size real DEFAULT 1 NOT NULL,
    pack_unit text DEFAULT 'g'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    material_code text,
    description text,
    flavour text,
    serving_qty real DEFAULT 1 NOT NULL,
    kcal_per_serving real
);


--
-- Name: ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredients_id_seq OWNED BY public.ingredients.id;


--
-- Name: issuances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issuances (
    id integer NOT NULL,
    member_id integer,
    center_id text,
    pack_label text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    status text
);


--
-- Name: issuances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.issuances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: issuances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.issuances_id_seq OWNED BY public.issuances.id;


--
-- Name: member_broadcast_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_broadcast_reads (
    id integer NOT NULL,
    member_id integer NOT NULL,
    broadcast_id integer NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: member_broadcast_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_broadcast_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_broadcast_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_broadcast_reads_id_seq OWNED BY public.member_broadcast_reads.id;


--
-- Name: member_broadcasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_broadcasts (
    id integer NOT NULL,
    center_id text NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_by text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: member_broadcasts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_broadcasts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_broadcasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_broadcasts_id_seq OWNED BY public.member_broadcasts.id;


--
-- Name: member_center_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_center_mapping (
    member_id integer NOT NULL,
    center_id text NOT NULL
);


--
-- Name: member_check_ins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_check_ins (
    id integer NOT NULL,
    member_id integer NOT NULL,
    center_id text NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_out_at timestamp with time zone,
    cancelled boolean DEFAULT false NOT NULL
);


--
-- Name: member_check_ins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_check_ins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_check_ins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_check_ins_id_seq OWNED BY public.member_check_ins.id;


--
-- Name: members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id integer DEFAULT nextval('public.members_id_seq'::regclass) NOT NULL,
    name text NOT NULL,
    date_of_joining text,
    height_cm integer,
    mobile text,
    email text,
    membership_no text,
    dob text,
    age_at_joining real,
    valid_until date,
    is_active boolean DEFAULT true NOT NULL,
    gemini_api_key text,
    daily_kcal integer
);


--
-- Name: menu_item_bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_bom (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    ingredient text NOT NULL,
    quantity real DEFAULT 0 NOT NULL,
    unit text DEFAULT 'g'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kcal real,
    ingredient_id integer
);


--
-- Name: menu_item_bom_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_item_bom_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_item_bom_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_item_bom_id_seq OWNED BY public.menu_item_bom.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    center_id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    flavours text DEFAULT ''::text NOT NULL,
    available_days text DEFAULT 'all'::text NOT NULL
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otps (
    id integer NOT NULL,
    mobile text,
    otp text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    email text,
    member_id integer,
    otp_token text
);


--
-- Name: otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otps_id_seq OWNED BY public.otps.id;


--
-- Name: pack_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pack_sizes (
    id integer NOT NULL,
    item_name text NOT NULL,
    pack_label text,
    weight_g real,
    calories_kcal real
);


--
-- Name: pack_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pack_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pack_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pack_sizes_id_seq OWNED BY public.pack_sizes.id;


--
-- Name: super_admin_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admin_auth (
    id text DEFAULT 'superadmin'::text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: super_admin_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admin_reset_tokens (
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auth (
    id integer NOT NULL,
    mobile text,
    member_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text
);


--
-- Name: user_auth_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_auth_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_auth_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_auth_id_seq OWNED BY public.user_auth.id;


--
-- Name: visit_flavour_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_flavour_selections (
    id integer NOT NULL,
    checkin_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    flavour text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: visit_flavour_selections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_flavour_selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_flavour_selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_flavour_selections_id_seq OWNED BY public.visit_flavour_selections.id;


--
-- Name: visit_menu_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_menu_selections (
    id integer NOT NULL,
    checkin_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    selected_flavour text
);


--
-- Name: visit_menu_selections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visit_menu_selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visit_menu_selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visit_menu_selections_id_seq OWNED BY public.visit_menu_selections.id;


--
-- Name: batch_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_adjustments ALTER COLUMN id SET DEFAULT nextval('public.batch_adjustments_id_seq'::regclass);


--
-- Name: batch_consumption_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_consumption_logs ALTER COLUMN id SET DEFAULT nextval('public.batch_consumption_logs_id_seq'::regclass);


--
-- Name: bom_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items ALTER COLUMN id SET DEFAULT nextval('public.bom_items_id_seq'::regclass);


--
-- Name: center_broadcast_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_broadcast_schedules ALTER COLUMN id SET DEFAULT nextval('public.center_broadcast_schedules_id_seq'::regclass);


--
-- Name: center_flavours id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_flavours ALTER COLUMN id SET DEFAULT nextval('public.center_flavours_id_seq'::regclass);


--
-- Name: consumption_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumption_logs ALTER COLUMN id SET DEFAULT nextval('public.consumption_logs_id_seq'::regclass);


--
-- Name: health_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_records ALTER COLUMN id SET DEFAULT nextval('public.health_records_id_seq'::regclass);


--
-- Name: ingredient_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_batches ALTER COLUMN id SET DEFAULT nextval('public.ingredient_batches_id_seq'::regclass);


--
-- Name: ingredients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients ALTER COLUMN id SET DEFAULT nextval('public.ingredients_id_seq'::regclass);


--
-- Name: issuances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issuances ALTER COLUMN id SET DEFAULT nextval('public.issuances_id_seq'::regclass);


--
-- Name: member_broadcast_reads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcast_reads ALTER COLUMN id SET DEFAULT nextval('public.member_broadcast_reads_id_seq'::regclass);


--
-- Name: member_broadcasts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcasts ALTER COLUMN id SET DEFAULT nextval('public.member_broadcasts_id_seq'::regclass);


--
-- Name: member_check_ins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_check_ins ALTER COLUMN id SET DEFAULT nextval('public.member_check_ins_id_seq'::regclass);


--
-- Name: menu_item_bom id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_bom ALTER COLUMN id SET DEFAULT nextval('public.menu_item_bom_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: otps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps ALTER COLUMN id SET DEFAULT nextval('public.otps_id_seq'::regclass);


--
-- Name: pack_sizes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pack_sizes ALTER COLUMN id SET DEFAULT nextval('public.pack_sizes_id_seq'::regclass);


--
-- Name: user_auth id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth ALTER COLUMN id SET DEFAULT nextval('public.user_auth_id_seq'::regclass);


--
-- Name: visit_flavour_selections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_flavour_selections ALTER COLUMN id SET DEFAULT nextval('public.visit_flavour_selections_id_seq'::regclass);


--
-- Name: visit_menu_selections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_menu_selections ALTER COLUMN id SET DEFAULT nextval('public.visit_menu_selections_id_seq'::regclass);


--
-- Data for Name: batch_adjustments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.batch_adjustments (id, batch_id, qty_change, note, adjusted_at) FROM stdin;
\.


--
-- Data for Name: batch_consumption_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.batch_consumption_logs (id, batch_id, quantity, notes, recorded_at) FROM stdin;
10	9	27	auto: member visit	2026-06-30 18:05:03.927611+00
11	11	6	auto: member visit	2026-06-30 18:05:03.932454+00
12	8	25	auto: flavour visit	2026-06-30 18:05:03.940643+00
13	10	1	auto: flavour visit	2026-06-30 18:05:03.946141+00
14	8	25	auto: flavour visit	2026-06-30 18:15:55.169521+00
15	10	1	auto: flavour visit	2026-06-30 18:15:55.175744+00
16	9	27	auto: member visit	2026-06-30 18:32:25.86908+00
17	11	6	auto: member visit	2026-06-30 18:32:25.873418+00
18	10	1	auto: flavour visit	2026-06-30 18:32:25.880931+00
19	8	25	auto: flavour visit	2026-06-30 18:32:25.888442+00
\.


--
-- Data for Name: bom_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bom_items (id, plan_name, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g) FROM stdin;
\.


--
-- Data for Name: center_auth; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.center_auth (center_id, password_hash, created_at, valid_until) FROM stdin;
CI-1	$2b$10$gfPd7DPjtk2jB1OxLmiplOJkCpIVmNu1paEao6lDpOXyRGEMh7UyK	2026-06-26 14:27:15.171553+00	2026-07-27
CI-2	$2b$10$u698mKr3gOc0VZh6gJcZpOy.uWB7DQf8mWfIln6iLI8JQhj9MYrfG	2026-06-26 14:27:15.243268+00	2026-07-27
Home	$2b$10$/iA6MwgWGvuTJb.Cdj.vjuMUcILOvghREvNVVxCZPu3fR5JiTvv4W	2026-06-26 14:27:15.313267+00	2026-07-27
\.


--
-- Data for Name: center_broadcast_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.center_broadcast_schedules (id, center_id, message, schedule_time, is_active, last_sent_at, created_at, updated_at) FROM stdin;
1	CI-2	Hello from CI-2	09:00	t	\N	2026-07-01 04:55:23.914744+00	2026-07-01 04:55:23.914744+00
3	CI-1	Good morning! Log your breakfast.	09:00	t	\N	2026-07-01 04:55:34.818707+00	2026-07-01 04:55:34.818707+00
4	CI-1	Afternoon reminder: stay hydrated!	14:00	t	\N	2026-07-01 04:55:34.818707+00	2026-07-01 04:55:34.818707+00
5	CI-1	Test immediate broadcast	04:56.0001	t	\N	2026-07-01 04:56:09.096106+00	2026-07-01 04:56:09.096106+00
2	CI-1	Time for breakfast, please record same	09:00	t	\N	2026-07-01 04:55:23.914744+00	2026-07-01 05:04:32.609765+00
\.


--
-- Data for Name: center_broadcast_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.center_broadcast_settings (center_id, created_at, updated_at, retention_days) FROM stdin;
CI-2	2026-07-01 04:23:51.90884+00	2026-07-01 04:23:51.90884+00	3
CI-1	2026-07-01 04:24:05.687718+00	2026-07-01 05:03:37.818783+00	1
\.


--
-- Data for Name: center_flavours; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.center_flavours (id, center_id, name, created_at, serving_qty, available_days) FROM stdin;
2	CI-1	Kulfi	2026-06-30 15:58:29.258218+00	25	all
1	CI-1	Chocolate	2026-06-30 15:58:22.488921+00	25	all
3	CI-1	Banana	2026-06-30 15:58:35.168507+00	25	all
4	CI-1	Straberry	2026-06-30 15:58:57.784608+00	25	all
34	CI-1	Afresh Lemon	2026-06-30 17:24:39.642423+00	1	Sun
35	CI-1	Afresh Elaichi	2026-06-30 17:25:03.987159+00	1	Tue,Wed
\.


--
-- Data for Name: centers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.centers (id, name, is_active, auto_checkout_min, photo_retention_days) FROM stdin;
Home	Home	t	180	2
CI-2	Center CI-2	t	180	2
CI-1	Center CI-1	t	120	1
\.


--
-- Data for Name: consumption_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.consumption_logs (id, member_id, logged_at, meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, menu_item_id, selected_flavour, checkin_id, photo_url, photo_uploaded_at) FROM stdin;
7	10	2026-06-30 18:05:03.91302+00	Dinner	Protein Shake	\N	173	\N	\N	\N	3	\N	7	\N	\N
8	10	2026-06-30 18:05:03.937582+00	Dinner	Formula1 Kulfi – Kulfi	25	\N	\N	\N	\N	\N	\N	7	\N	\N
9	10	2026-06-30 18:05:03.943562+00	Dinner	Afresh Elaichi – Afresh Elaichi	1	\N	\N	\N	\N	\N	\N	7	\N	\N
10	9	2026-06-30 18:15:55.165676+00	Dinner	Formula1 Kulfi – Kulfi	25	\N	\N	\N	\N	\N	\N	9	\N	\N
11	9	2026-06-30 18:15:55.173328+00	Dinner	Afresh Elaichi – Afresh Elaichi	1	\N	\N	\N	\N	\N	\N	9	\N	\N
12	9	2026-06-30 18:32:25.856335+00	Breakfast	Protein Shake	\N	173	\N	\N	\N	3	\N	11	\N	\N
13	9	2026-06-30 18:32:25.878315+00	Breakfast	Afresh Elaichi – Afresh Elaichi	1	5	\N	\N	\N	\N	\N	11	\N	\N
14	9	2026-06-30 18:32:25.885477+00	Breakfast	Formula1 Kulfi – Kulfi	25	50	\N	\N	\N	\N	\N	11	\N	\N
\.


--
-- Data for Name: health_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.health_records (id, member_id, center_id, recorded_at, weight_kg, bmi, resting_hr, notes, body_fat_pct, visceral_fat, bmr, metabolic_age, muscle_mass_kg) FROM stdin;
1	7	CI-1	2026-06-26 00:00:00+00	78	29	60	\N	34	24	1750	62	34
2	6	CI-1	2026-06-27 07:56:43.040044+00	77.2	\N	\N	\N	\N	\N	\N	\N	\N
3	8	CI-1	2026-06-27 00:00:00+00	52	23	66	\N	22	10	1500	25	30
4	6	CI-1	2026-06-27 08:20:11.999989+00	76	\N	\N	\N	\N	\N	\N	\N	\N
5	9	CI-1	2026-06-27 00:00:00+00	55	23	65	\N	22	10	1500	29	22
6	9	CI-1	2026-06-27 08:35:21.76376+00	54	\N	\N	\N	\N	\N	\N	\N	\N
7	9	CI-1	2026-06-27 08:57:04.188601+00	55	\N	\N	\N	\N	\N	\N	\N	\N
8	9	CI-1	2026-06-27 09:04:44.984295+00	55	\N	\N	\N	\N	\N	\N	\N	\N
9	9	CI-1	2026-06-27 09:09:19.045373+00	55	\N	\N	\N	\N	\N	\N	\N	\N
10	6	CI-1	2026-06-27 09:25:58.907182+00	77	\N	\N	\N	\N	\N	\N	\N	\N
11	10	CI-1	2026-06-30 00:00:00+00	80	25	66	\N	22	7	1800	66	29
12	6	CI-1	2026-06-30 12:45:55.824954+00	74	\N	\N	\N	\N	\N	\N	\N	\N
13	6	CI-1	2026-06-30 12:54:53.207105+00	69	\N	\N	\N	\N	\N	\N	\N	\N
14	6	CI-1	2026-06-30 00:00:00+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
15	9	CI-1	2026-06-30 17:39:11.650415+00	55	\N	\N	\N	\N	\N	\N	\N	\N
16	2	CI-1	2026-06-30 17:46:12.505941+00	66	\N	\N	\N	\N	\N	\N	\N	\N
17	10	CI-1	2026-06-30 17:52:21.977724+00	77	\N	\N	\N	\N	\N	\N	\N	\N
18	6	CI-1	2026-06-30 18:15:13.314089+00	66	\N	\N	\N	\N	\N	\N	\N	\N
19	9	CI-1	2026-06-30 18:15:44.435343+00	55	\N	\N	\N	\N	\N	\N	\N	\N
20	1	CI-1	2026-06-30 18:27:21.697281+00	77	\N	\N	\N	\N	\N	\N	\N	\N
21	9	CI-1	2026-06-30 18:31:20.629292+00	55	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: ingredient_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingredient_batches (id, ingredient_id, center_id, batch_number, status, opened_at, consumed_at, created_at, assigned_member_id, assigned_member_name, received_qty, received_unit) FROM stdin;
8	8	CI-1	kulfi	open	2026-06-30 17:02:06.311913+00	\N	2026-06-30 17:02:06.215485+00	\N	\N	500	g
9	9	CI-1	Shakemate1	open	2026-06-30 17:02:32.964477+00	\N	2026-06-30 17:02:32.90471+00	\N	\N	500	g
10	10	CI-1	Elachi1	open	2026-06-30 17:39:43.960536+00	\N	2026-06-30 17:39:43.856991+00	\N	\N	50	g
11	11	CI-1	PP1	open	2026-06-30 17:40:05.685969+00	\N	2026-06-30 17:40:05.375669+00	\N	\N	400	g
\.


--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingredients (id, name, pack_size, pack_unit, created_at, material_code, description, flavour, serving_qty, kcal_per_serving) FROM stdin;
11	Personalised Protein	1	g	2026-06-30 17:04:17.149958+00	Protein	Personalised Protein	\N	1	\N
9	Shakemate	500	g	2026-06-30 16:15:19.376847+00	Shakemate500	\N	\N	1	\N
10	Afresh Elaichi	1	g	2026-06-30 17:03:54.124927+00	AfreshElachi	\N	Afresh Elaichi	1	5
12	Afresh Lemon	1	g	2026-06-30 17:30:00.094997+00	AfresLemon	\N	Afresh Lemon	1	5
8	Formula1 Kulfi	500	g	2026-06-30 16:10:37.708291+00	Formula1Kulfi	\N	Kulfi	25	50
\.


--
-- Data for Name: issuances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.issuances (id, member_id, center_id, pack_label, issued_at, status) FROM stdin;
\.


--
-- Data for Name: member_broadcast_reads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_broadcast_reads (id, member_id, broadcast_id, read_at) FROM stdin;
1	3	3	2026-07-01 04:18:12.794204+00
\.


--
-- Data for Name: member_broadcasts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_broadcasts (id, center_id, message, sent_at, sent_by, created_at) FROM stdin;
2	CI-1	Reminder: Log your meals today and stay hydrated!	2026-07-01 04:17:53.355387+00	manual	2026-07-01 04:17:53.355387+00
3	CI-2	Do not forget your daily weigh-in!	2026-07-01 04:18:03.248202+00	scheduled	2026-07-01 04:18:03.248202+00
4	CI-2	Welcome to CI-2	2026-07-01 04:23:58.470435+00	manual	2026-07-01 04:23:58.470435+00
5	CI-1	Welcome to CI-1	2026-07-01 04:24:06.465655+00	manual	2026-07-01 04:24:06.465655+00
\.


--
-- Data for Name: member_center_mapping; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_center_mapping (member_id, center_id) FROM stdin;
1	CI-1
1	Home
2	CI-1
2	Home
3	CI-2
4	CI-1
5	CI-1
6	CI-1
9	CI-1
10	CI-1
\.


--
-- Data for Name: member_check_ins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.member_check_ins (id, member_id, center_id, checked_in_at, checked_out_at, cancelled) FROM stdin;
1	9	CI-1	2026-06-27 09:09:19.040509+00	2026-06-27 09:09:24.067953+00	f
2	6	CI-1	2026-06-27 09:25:58.903444+00	2026-06-27 09:26:04.054042+00	f
3	6	CI-1	2026-06-30 12:45:55.818437+00	2026-06-30 12:54:26.854642+00	t
4	6	CI-1	2026-06-30 12:54:53.202329+00	2026-06-30 12:55:21.224814+00	f
5	9	CI-1	2026-06-30 17:39:11.635782+00	2026-06-30 17:45:56.970726+00	t
6	2	CI-1	2026-06-30 17:46:12.5017+00	2026-06-30 17:52:11.407837+00	t
7	10	CI-1	2026-06-30 17:52:21.972916+00	2026-06-30 18:05:03.948533+00	f
8	6	CI-1	2026-06-30 18:15:13.309899+00	2026-06-30 18:15:36.390241+00	t
9	9	CI-1	2026-06-30 18:15:44.431135+00	2026-06-30 18:15:55.179187+00	f
10	1	CI-1	2026-06-30 18:27:21.691624+00	2026-06-30 18:31:12.805155+00	t
11	9	CI-1	2026-06-30 18:31:20.62528+00	2026-06-30 18:32:25.891922+00	f
\.


--
-- Data for Name: members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.members (id, name, date_of_joining, height_cm, mobile, email, membership_no, dob, age_at_joining, valid_until, is_active, gemini_api_key, daily_kcal) FROM stdin;
10	Shailendra Rai	2026-01-01	170	+918127433118	\N	HB090	01 Mar	55	2026-08-30	t	\N	\N
2	E2E Mobile	\N	\N	9000000002	\N	NMW-2	\N	\N	\N	t	\N	\N
3	E2E Email	\N	\N	\N	newuser@example.com	NMW-3	\N	\N	\N	t	\N	\N
4	Email User	\N	\N	\N	freshuser1782476885@example.com	NMW-4	\N	\N	\N	t	\N	\N
5	Mobile User	\N	\N	9000476886	\N	NMW-5	\N	\N	\N	t	\N	\N
7	Satish Test2	\N	\N	8527577774	\N	NMW-7	\N	\N	\N	t	\N	\N
8	Divya	2025-01-01	\N	\N	\N	NMW-8	\N	\N	\N	t	\N	\N
9	Divya	2025-01-01	160	\N	divya@test.com	NMW-9	\N	\N	\N	t	\N	\N
6	Satish Test1	\N	\N	\N	rai.174@gmail.com	NMW-6	\N	\N	2026-07-08	t	\N	\N
1	Demo Member	2024-01-01	170	\N	\N	NMW-1	\N	\N	\N	t	\N	1800
\.


--
-- Data for Name: menu_item_bom; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_item_bom (id, menu_item_id, ingredient, quantity, unit, created_at, kcal, ingredient_id) FROM stdin;
15	3	Shakemate	27	g	2026-06-30 17:05:54.524685+00	123	9
16	3	Personalised Protein	6	g	2026-06-30 17:07:01.196051+00	50	11
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_items (id, center_id, name, description, created_at, is_mandatory, flavours, available_days) FROM stdin;
2	CI-2	CI-2 Exclusive Shake	center 2 only	2026-06-26 14:32:16.015772+00	f		all
3	CI-1	Protein Shake	Choclate Shake	2026-06-26 15:15:14.660514+00	t		all
\.


--
-- Data for Name: otps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otps (id, mobile, otp, expires_at, used, email, member_id, otp_token) FROM stdin;
1	\N	217530	2026-06-27 08:17:39.578+00	t	rai.174@gmail.com	\N	\N
2	\N	230322	2026-06-28 02:31:08.782+00	t	rai.174@gmail.com	\N	\N
3	\N	149368	2026-06-28 12:24:00.977+00	t	rai.174@gmail.com	\N	\N
4	8527577774	967169	2026-06-30 18:13:14.59+00	t	\N	\N	\N
5	\N	227003	2026-06-30 18:13:42.943+00	t	rai.174@gmail.com	\N	\N
6	\N	465230	2026-07-01 04:09:39.309+00	t	newuser@example.com	3	bde774e77d1d33a4c478275a4c9e8d49
7	\N	534358	2026-07-01 04:15:37.642+00	t	rai.174@gmail.com	6	8e09dd410f2828b0408da15dcab87360
\.


--
-- Data for Name: pack_sizes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pack_sizes (id, item_name, pack_label, weight_g, calories_kcal) FROM stdin;
\.


--
-- Data for Name: super_admin_auth; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.super_admin_auth (id, password_hash, created_at) FROM stdin;
superadmin	$2b$10$oy7tPSVhsfIjPROpPmOp8OB9XY1GG2qBekBE2.afwEd6SCTgEgTDy	2026-06-26 14:40:24.478503+00
\.


--
-- Data for Name: super_admin_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.super_admin_reset_tokens (token, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_auth; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_auth (id, mobile, member_id, created_at, email) FROM stdin;
1	9000000002	2	2026-06-26 12:26:40.846158+00	\N
2	\N	4	2026-06-26 12:28:06.051405+00	freshuser1782476885@example.com
3	9000476886	5	2026-06-26 12:28:06.268847+00	\N
4	\N	6	2026-06-26 12:28:30.869563+00	rai.174@gmail.com
5	8527577774	7	2026-06-26 13:01:16.701156+00	\N
6	\N	3	2026-07-01 03:59:44.36061+00	newuser@example.com
\.


--
-- Data for Name: visit_flavour_selections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visit_flavour_selections (id, checkin_id, ingredient_id, flavour, created_at) FROM stdin;
1	7	8	Kulfi	2026-06-30 18:04:55.596909+00
2	7	10	Afresh Elaichi	2026-06-30 18:04:56.911581+00
3	9	8	Kulfi	2026-06-30 18:15:47.104676+00
4	9	10	Afresh Elaichi	2026-06-30 18:15:48.039333+00
6	10	10	Afresh Elaichi	2026-06-30 18:27:24.728058+00
8	10	8	Kulfi	2026-06-30 18:31:00.71218+00
10	11	10	Afresh Elaichi	2026-06-30 18:31:53.911406+00
11	11	8	Kulfi	2026-06-30 18:31:56.902145+00
\.


--
-- Data for Name: visit_menu_selections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visit_menu_selections (id, checkin_id, menu_item_id, created_at, selected_flavour) FROM stdin;
10	7	3	2026-06-30 17:52:21.982999+00	\N
12	11	3	2026-06-30 18:31:20.641855+00	\N
\.


--
-- Name: batch_adjustments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.batch_adjustments_id_seq', 1, false);


--
-- Name: batch_consumption_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.batch_consumption_logs_id_seq', 19, true);


--
-- Name: bom_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bom_items_id_seq', 1, false);


--
-- Name: center_broadcast_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.center_broadcast_schedules_id_seq', 5, true);


--
-- Name: center_flavours_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.center_flavours_id_seq', 35, true);


--
-- Name: consumption_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.consumption_logs_id_seq', 14, true);


--
-- Name: health_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.health_records_id_seq', 21, true);


--
-- Name: ingredient_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ingredient_batches_id_seq', 11, true);


--
-- Name: ingredients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ingredients_id_seq', 12, true);


--
-- Name: issuances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.issuances_id_seq', 1, false);


--
-- Name: member_broadcast_reads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_broadcast_reads_id_seq', 1, true);


--
-- Name: member_broadcasts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_broadcasts_id_seq', 5, true);


--
-- Name: member_check_ins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.member_check_ins_id_seq', 11, true);


--
-- Name: members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.members_id_seq', 10, true);


--
-- Name: menu_item_bom_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_item_bom_id_seq', 16, true);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 5, true);


--
-- Name: otps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otps_id_seq', 7, true);


--
-- Name: pack_sizes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pack_sizes_id_seq', 1, false);


--
-- Name: user_auth_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_auth_id_seq', 6, true);


--
-- Name: visit_flavour_selections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.visit_flavour_selections_id_seq', 11, true);


--
-- Name: visit_menu_selections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.visit_menu_selections_id_seq', 12, true);


--
-- Name: batch_adjustments batch_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_adjustments
    ADD CONSTRAINT batch_adjustments_pkey PRIMARY KEY (id);


--
-- Name: batch_consumption_logs batch_consumption_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_consumption_logs
    ADD CONSTRAINT batch_consumption_logs_pkey PRIMARY KEY (id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: center_auth center_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_auth
    ADD CONSTRAINT center_auth_pkey PRIMARY KEY (center_id);


--
-- Name: center_broadcast_schedules center_broadcast_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_broadcast_schedules
    ADD CONSTRAINT center_broadcast_schedules_pkey PRIMARY KEY (id);


--
-- Name: center_broadcast_settings center_broadcast_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_broadcast_settings
    ADD CONSTRAINT center_broadcast_settings_pkey PRIMARY KEY (center_id);


--
-- Name: center_flavours center_flavours_center_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_flavours
    ADD CONSTRAINT center_flavours_center_id_name_key UNIQUE (center_id, name);


--
-- Name: center_flavours center_flavours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_flavours
    ADD CONSTRAINT center_flavours_pkey PRIMARY KEY (id);


--
-- Name: centers centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.centers
    ADD CONSTRAINT centers_pkey PRIMARY KEY (id);


--
-- Name: consumption_logs consumption_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumption_logs
    ADD CONSTRAINT consumption_logs_pkey PRIMARY KEY (id);


--
-- Name: health_records health_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_pkey PRIMARY KEY (id);


--
-- Name: ingredient_batches ingredient_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_batches
    ADD CONSTRAINT ingredient_batches_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_name_key UNIQUE (name);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: issuances issuances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issuances
    ADD CONSTRAINT issuances_pkey PRIMARY KEY (id);


--
-- Name: member_broadcast_reads member_broadcast_reads_member_id_broadcast_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcast_reads
    ADD CONSTRAINT member_broadcast_reads_member_id_broadcast_id_key UNIQUE (member_id, broadcast_id);


--
-- Name: member_broadcast_reads member_broadcast_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcast_reads
    ADD CONSTRAINT member_broadcast_reads_pkey PRIMARY KEY (id);


--
-- Name: member_broadcasts member_broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcasts
    ADD CONSTRAINT member_broadcasts_pkey PRIMARY KEY (id);


--
-- Name: member_center_mapping member_center_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_center_mapping
    ADD CONSTRAINT member_center_mapping_pkey PRIMARY KEY (member_id, center_id);


--
-- Name: member_check_ins member_check_ins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_check_ins
    ADD CONSTRAINT member_check_ins_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: menu_item_bom menu_item_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_bom
    ADD CONSTRAINT menu_item_bom_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: pack_sizes pack_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pack_sizes
    ADD CONSTRAINT pack_sizes_pkey PRIMARY KEY (id);


--
-- Name: super_admin_auth super_admin_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_auth
    ADD CONSTRAINT super_admin_auth_pkey PRIMARY KEY (id);


--
-- Name: super_admin_reset_tokens super_admin_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_reset_tokens
    ADD CONSTRAINT super_admin_reset_tokens_pkey PRIMARY KEY (token);


--
-- Name: user_auth user_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_pkey PRIMARY KEY (id);


--
-- Name: visit_flavour_selections visit_flavour_selections_checkin_id_ingredient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_flavour_selections
    ADD CONSTRAINT visit_flavour_selections_checkin_id_ingredient_id_key UNIQUE (checkin_id, ingredient_id);


--
-- Name: visit_flavour_selections visit_flavour_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_flavour_selections
    ADD CONSTRAINT visit_flavour_selections_pkey PRIMARY KEY (id);


--
-- Name: visit_menu_selections visit_menu_selections_checkin_id_menu_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_menu_selections
    ADD CONSTRAINT visit_menu_selections_checkin_id_menu_item_id_key UNIQUE (checkin_id, menu_item_id);


--
-- Name: visit_menu_selections visit_menu_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_menu_selections
    ADD CONSTRAINT visit_menu_selections_pkey PRIMARY KEY (id);


--
-- Name: center_broadcast_schedules_center_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX center_broadcast_schedules_center_idx ON public.center_broadcast_schedules USING btree (center_id);


--
-- Name: member_broadcast_reads_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_broadcast_reads_member_idx ON public.member_broadcast_reads USING btree (member_id);


--
-- Name: member_broadcasts_center_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_broadcasts_center_idx ON public.member_broadcasts USING btree (center_id);


--
-- Name: member_broadcasts_sent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_broadcasts_sent_idx ON public.member_broadcasts USING btree (sent_at DESC);


--
-- Name: member_check_ins_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX member_check_ins_active_idx ON public.member_check_ins USING btree (member_id) WHERE (checked_out_at IS NULL);


--
-- Name: members_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX members_email_idx ON public.members USING btree (email);


--
-- Name: members_membership_no_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX members_membership_no_idx ON public.members USING btree (membership_no);


--
-- Name: members_membership_no_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX members_membership_no_uidx ON public.members USING btree (membership_no) WHERE (membership_no IS NOT NULL);


--
-- Name: members_mobile_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX members_mobile_uidx ON public.members USING btree (mobile) WHERE (mobile IS NOT NULL);


--
-- Name: menu_items_center_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX menu_items_center_name_uidx ON public.menu_items USING btree (center_id, lower(name));


--
-- Name: otps_member_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otps_member_idx ON public.otps USING btree (member_id);


--
-- Name: otps_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otps_token_idx ON public.otps USING btree (otp_token);


--
-- Name: uidx_ingredient_batches_open_center; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uidx_ingredient_batches_open_center ON public.ingredient_batches USING btree (ingredient_id, center_id) WHERE ((status = 'open'::text) AND (assigned_member_id IS NULL));


--
-- Name: user_auth_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_auth_email_idx ON public.user_auth USING btree (email);


--
-- Name: user_auth_mobile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_auth_mobile_idx ON public.user_auth USING btree (mobile);


--
-- Name: batch_adjustments batch_adjustments_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_adjustments
    ADD CONSTRAINT batch_adjustments_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.ingredient_batches(id) ON DELETE CASCADE;


--
-- Name: batch_consumption_logs batch_consumption_logs_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_consumption_logs
    ADD CONSTRAINT batch_consumption_logs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.ingredient_batches(id) ON DELETE CASCADE;


--
-- Name: center_auth center_auth_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_auth
    ADD CONSTRAINT center_auth_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: center_broadcast_schedules center_broadcast_schedules_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_broadcast_schedules
    ADD CONSTRAINT center_broadcast_schedules_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;


--
-- Name: center_broadcast_settings center_broadcast_settings_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_broadcast_settings
    ADD CONSTRAINT center_broadcast_settings_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;


--
-- Name: center_flavours center_flavours_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.center_flavours
    ADD CONSTRAINT center_flavours_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;


--
-- Name: consumption_logs consumption_logs_checkin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumption_logs
    ADD CONSTRAINT consumption_logs_checkin_id_fkey FOREIGN KEY (checkin_id) REFERENCES public.member_check_ins(id) ON DELETE SET NULL;


--
-- Name: consumption_logs consumption_logs_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumption_logs
    ADD CONSTRAINT consumption_logs_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: consumption_logs consumption_logs_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumption_logs
    ADD CONSTRAINT consumption_logs_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: health_records health_records_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: health_records health_records_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_records
    ADD CONSTRAINT health_records_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: ingredient_batches ingredient_batches_assigned_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_batches
    ADD CONSTRAINT ingredient_batches_assigned_member_id_fkey FOREIGN KEY (assigned_member_id) REFERENCES public.members(id) ON DELETE SET NULL;


--
-- Name: ingredient_batches ingredient_batches_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_batches
    ADD CONSTRAINT ingredient_batches_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: ingredient_batches ingredient_batches_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient_batches
    ADD CONSTRAINT ingredient_batches_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: issuances issuances_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issuances
    ADD CONSTRAINT issuances_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: issuances issuances_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issuances
    ADD CONSTRAINT issuances_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: member_broadcast_reads member_broadcast_reads_broadcast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcast_reads
    ADD CONSTRAINT member_broadcast_reads_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES public.member_broadcasts(id) ON DELETE CASCADE;


--
-- Name: member_broadcast_reads member_broadcast_reads_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcast_reads
    ADD CONSTRAINT member_broadcast_reads_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: member_broadcasts member_broadcasts_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_broadcasts
    ADD CONSTRAINT member_broadcasts_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id) ON DELETE CASCADE;


--
-- Name: member_center_mapping member_center_mapping_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_center_mapping
    ADD CONSTRAINT member_center_mapping_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: member_center_mapping member_center_mapping_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_center_mapping
    ADD CONSTRAINT member_center_mapping_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: member_check_ins member_check_ins_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_check_ins
    ADD CONSTRAINT member_check_ins_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: member_check_ins member_check_ins_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_check_ins
    ADD CONSTRAINT member_check_ins_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: menu_item_bom menu_item_bom_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_bom
    ADD CONSTRAINT menu_item_bom_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: menu_item_bom menu_item_bom_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_bom
    ADD CONSTRAINT menu_item_bom_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.centers(id);


--
-- Name: otps otps_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: user_auth user_auth_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth
    ADD CONSTRAINT user_auth_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: visit_flavour_selections visit_flavour_selections_checkin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_flavour_selections
    ADD CONSTRAINT visit_flavour_selections_checkin_id_fkey FOREIGN KEY (checkin_id) REFERENCES public.member_check_ins(id) ON DELETE CASCADE;


--
-- Name: visit_flavour_selections visit_flavour_selections_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_flavour_selections
    ADD CONSTRAINT visit_flavour_selections_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;


--
-- Name: visit_menu_selections visit_menu_selections_checkin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_menu_selections
    ADD CONSTRAINT visit_menu_selections_checkin_id_fkey FOREIGN KEY (checkin_id) REFERENCES public.member_check_ins(id) ON DELETE CASCADE;


--
-- Name: visit_menu_selections visit_menu_selections_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_menu_selections
    ADD CONSTRAINT visit_menu_selections_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict gcHQMg7gLu1kwdeL9GVnXE4tw9NyQ1PM82tlcT426EwJoU5iLeeEhafJZcOTAHl

