-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
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

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: EXTENSION "pg_graphql"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_graphql" IS 'pg_graphql: GraphQL support';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: change_user_role("uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."change_user_role"("p_target_user_id" "uuid", "p_new_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_email text;
  v_caller_name text;
  v_target_role text;
  v_target_email text;
  v_target_name text;
  v_admin_count integer;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '未授权：请先登录';
  END IF;

  -- 校验操作者是否是管理员
  SELECT role::text, email, nickname INTO v_caller_role, v_caller_email, v_caller_name
  FROM public.profiles WHERE id = v_caller_id;

  IF v_caller_role != 'admin' THEN
    RAISE EXCEPTION '权限不足：仅管理员可调整用户角色';
  END IF;

  -- 不能修改自己
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION '操作被拒绝：管理员不能调整自身角色';
  END IF;

  -- 校验目标角色合法性
  IF p_new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION '无效的目标角色：%s', p_new_role;
  END IF;

  -- 获取目标用户信息
  SELECT role::text, email, nickname INTO v_target_role, v_target_email, v_target_name
  FROM public.profiles WHERE id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION '目标用户不存在';
  END IF;

  -- 若是降级为 user，必须检查是否是最后一个管理员
  IF v_target_role = 'admin' AND p_new_role = 'user' THEN
    SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin'::user_role;
    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION '操作被拒绝：系统必须保留至少一名管理员，无法降级';
    END IF;
  END IF;

  -- 执行角色更新
  UPDATE public.profiles
  SET role = p_new_role::user_role
  WHERE id = p_target_user_id;

  -- 写入管理员操作审计日志
  INSERT INTO public.admin_audit_logs (
    operator_id,
    operator_email,
    operator_name,
    action,
    target_user_id,
    target_user_email,
    target_user_name,
    details
  ) VALUES (
    v_caller_id,
    v_caller_email,
    v_caller_name,
    CASE WHEN p_new_role = 'admin' THEN 'grant_admin' ELSE 'revoke_admin' END,
    p_target_user_id,
    v_target_email,
    v_target_name,
    jsonb_build_object(
      'from_role', v_target_role,
      'to_role', p_new_role,
      'operated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'new_role', p_new_role
  );
END;
$$;


--
-- Name: get_pet_today_feeding_stats("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_pet_today_feeding_stats"("p_pet_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai');
  v_total_grams integer := 0;
  v_count integer := 0;
  v_overfed_count integer := 0;
  v_forbidden_count integer := 0;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(amount_grams, 50)), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'overfed' OR status = 'warning'),
    COUNT(*) FILTER (WHERE is_forbidden = true OR status = 'forbidden')
  INTO
    v_total_grams,
    v_count,
    v_overfed_count,
    v_forbidden_count
  FROM public.feedings
  WHERE pet_id = p_pet_id
    AND fed_at >= v_today_start;

  RETURN jsonb_build_object(
    'today_grams', v_total_grams,
    'today_count', v_count,
    'overfed_count', v_overfed_count,
    'forbidden_count', v_forbidden_count
  );
END;
$$;


--
-- Name: get_user_role("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_role"("uid" "uuid") RETURNS "public"."user_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    'user'::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '同学')
  );
  RETURN NEW;
END;
$$;


--
-- Name: is_admin("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."is_admin"("check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  u_role text;
BEGIN
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT role::text INTO u_role FROM public.profiles WHERE id = check_user_id;
  RETURN u_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;


--
-- Name: notify_lost_pet_broadcast(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."notify_lost_pet_broadcast"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_subscriber RECORD;
  v_message TEXT;
BEGIN
  IF NEW.status <> 'searching' THEN
    RETURN NEW;
  END IF;

  v_message := '【寻宠广播】' || COALESCE(NEW.pet_name, '一只萌宠') || '疑似走失！走失地点：' ||
    COALESCE(NEW.lost_location, '校园某处') || '。快去看看能否提供线索吧～';

  FOR v_subscriber IN
    SELECT id FROM public.profiles
    WHERE lost_pet_broadcast = true
      AND id <> NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      recipient_id, type, actor_id, pet_id, pet_name, message, is_read, created_at
    ) VALUES (
      v_subscriber.id,
      'lost_pet_broadcast',
      NEW.user_id,
      NEW.pet_id,
      COALESCE(NEW.pet_name, '校园萌宠'),
      v_message,
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: notify_on_adoption(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."notify_on_adoption"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_author uuid;
  v_name text;
BEGIN
  SELECT author_id, name INTO v_author, v_name FROM public.pets WHERE id = NEW.pet_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
    VALUES (v_author, 'adoption', NEW.user_id, NEW.pet_id, v_name, '申请领养你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_on_comment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."notify_on_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_author uuid;
  v_name text;
BEGIN
  SELECT author_id, name INTO v_author, v_name FROM public.pets WHERE id = NEW.pet_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
    VALUES (v_author, 'comment', NEW.user_id, NEW.pet_id, v_name, '评论了你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_on_favorite(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."notify_on_favorite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_author uuid;
  v_name text;
BEGIN
  SELECT author_id, name INTO v_author, v_name FROM public.pets WHERE id = NEW.pet_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
    VALUES (v_author, 'favorite', NEW.user_id, NEW.pet_id, v_name, '收藏了你发布的萌宠');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_on_pet_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."notify_on_pet_review"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_msg text;
BEGIN
  IF (TG_OP = 'UPDATE') AND (NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NEW.status = 'published' THEN
      v_msg := '你提交的萌宠档案「' || NEW.name || '」已审核通过';
      IF NEW.review_reason IS NOT NULL AND NEW.review_reason <> '' THEN
        v_msg := v_msg || '，审核建议：' || NEW.review_reason;
      END IF;
      INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
      VALUES (NEW.author_id, 'pet_review', auth.uid(), NEW.id, NEW.name, v_msg);
    ELSIF NEW.status = 'rejected' THEN
      v_msg := '你提交的萌宠档案「' || NEW.name || '」审核未通过，理由：' || COALESCE(NULLIF(NEW.review_reason,''), '未提供具体理由');
      INSERT INTO public.notifications (recipient_id, type, actor_id, pet_id, pet_name, message)
      VALUES (NEW.author_id, 'pet_review', auth.uid(), NEW.id, NEW.name, v_msg);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: protect_profile_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."protect_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 如果是在客户端请求中(auth.uid()存在)，且 role 发生变化
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    -- 如果当前操作者不是管理员，强行禁止修改 role
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION '权限不足：仅管理员可以调整角色字段';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: send_app_notification("uuid", "text", "uuid", "uuid", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."send_app_notification"("p_recipient_id" "uuid", "p_type" "text", "p_actor_id" "uuid", "p_pet_id" "uuid", "p_pet_name" "text", "p_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_notif_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    type,
    actor_id,
    pet_id,
    pet_name,
    message,
    is_read,
    created_at
  ) VALUES (
    p_recipient_id,
    p_type,
    COALESCE(p_actor_id, p_recipient_id),
    COALESCE(p_pet_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(p_pet_name, '校园萌宠'),
    p_message,
    false,
    NOW()
  )
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;


--
-- Name: sync_sighting_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."sync_sighting_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.location IS NULL AND NEW.location_name IS NOT NULL THEN
    NEW.location := NEW.location_name;
  ELSIF NEW.location_name IS NULL AND NEW.location IS NOT NULL THEN
    NEW.location_name := NEW.location;
  END IF;

  IF NEW.recorder_name IS NULL AND NEW.reporter_name IS NOT NULL THEN
    NEW.recorder_name := NEW.reporter_name;
  ELSIF NEW.reporter_name IS NULL AND NEW.recorder_name IS NOT NULL THEN
    NEW.reporter_name := NEW.recorder_name;
  END IF;

  IF NEW.notes IS NULL AND NEW.remark IS NOT NULL THEN
    NEW.notes := NEW.remark;
  ELSIF NEW.remark IS NULL AND NEW.notes IS NOT NULL THEN
    NEW.remark := NEW.notes;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: touch_last_seen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."touch_last_seen"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE id = v_uid;
  END IF;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "operator_email" "text",
    "operator_name" "text",
    "action" "text" NOT NULL,
    "target_user_id" "uuid",
    "target_user_email" "text",
    "target_user_name" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: adoptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."adoptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "applicant_name" "text" NOT NULL,
    "contact" "text" NOT NULL,
    "housing" "text" NOT NULL,
    "experience" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_notes" "text",
    "reviewed_at" timestamp with time zone,
    "reviewer_id" "uuid",
    CONSTRAINT "adoptions_experience_check" CHECK (("experience" = ANY (ARRAY['experienced'::"text", 'some'::"text", 'none'::"text"]))),
    CONSTRAINT "adoptions_housing_check" CHECK (("housing" = ANY (ARRAY['campus_dorm'::"text", 'off_campus_rent'::"text", 'own_home'::"text"]))),
    CONSTRAINT "adoptions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" DEFAULT '新对话'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: feeding_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."feeding_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "daily_amount_grams" integer DEFAULT 60 NOT NULL,
    "feed_times_per_day" integer DEFAULT 2 NOT NULL,
    "recommended_foods" "text"[] DEFAULT ARRAY['优质全价宠粮'::"text", '主食罐头'::"text"] NOT NULL,
    "feeding_time_slots" "text"[] DEFAULT ARRAY['早间 07:30 - 09:00'::"text", '傍晚 17:30 - 19:30'::"text"] NOT NULL,
    "forbidden_foods" "text"[] DEFAULT ARRAY['巧克力'::"text", '洋葱与大蒜'::"text", '葡萄与葡萄干'::"text", '木糖醇制品'::"text", '尖锐骨头与生肉'::"text"] NOT NULL,
    "risk_notes" "text" DEFAULT ''::"text",
    "ai_suggestion_raw" "jsonb",
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


--
-- Name: feedings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."feedings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "food" "text" NOT NULL,
    "fed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amount_grams" integer DEFAULT 50,
    "food_type" "text" DEFAULT 'dry_food'::"text",
    "photo_url" "text",
    "location" "text",
    "is_planned" boolean DEFAULT true,
    "is_forbidden" boolean DEFAULT false,
    "status" "text" DEFAULT 'normal'::"text",
    "warning_notes" "text"
);


--
-- Name: lost_pet_clues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."lost_pet_clues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lost_pet_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "sighting_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sighting_location" character varying(120) NOT NULL,
    "description" "text" NOT NULL,
    "photo_url" "text",
    "contact_info" character varying(100),
    "status" character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lost_pet_clues_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['normal'::character varying, 'verified'::character varying, 'hidden'::character varying])::"text"[])))
);


--
-- Name: lost_pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."lost_pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid",
    "user_id" "uuid",
    "title" character varying(120) NOT NULL,
    "pet_name" character varying(60) NOT NULL,
    "species" character varying(20) DEFAULT 'cat'::character varying NOT NULL,
    "breed" character varying(60),
    "gender" character varying(20) DEFAULT 'unknown'::character varying,
    "color" character varying(60),
    "features" "text",
    "lost_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lost_location" character varying(120) NOT NULL,
    "contact_name" character varying(60) NOT NULL,
    "contact_phone" character varying(60) NOT NULL,
    "reward_amount" character varying(60),
    "description" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" character varying(20) DEFAULT 'searching'::character varying NOT NULL,
    "views_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lost_pets_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'unknown'::character varying])::"text"[]))),
    CONSTRAINT "lost_pets_species_check" CHECK ((("species")::"text" = ANY ((ARRAY['cat'::character varying, 'dog'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "lost_pets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['searching'::character varying, 'found'::character varying, 'closed'::character varying])::"text"[])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "pet_id" "uuid",
    "pet_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['comment'::"text", 'favorite'::"text", 'adoption'::"text", 'pet_review'::"text", 'lost_pet_broadcast'::"text"])))
);


--
-- Name: pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "name" "text" NOT NULL,
    "gender" "text" NOT NULL,
    "coat_color" "text" NOT NULL,
    "personality_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "location_name" "text" NOT NULL,
    "lat" double precision,
    "lng" double precision,
    "photo_url" "text" NOT NULL,
    "is_neutered" boolean DEFAULT false NOT NULL,
    "author_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_reason" "text",
    CONSTRAINT "pets_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "pets_species_check" CHECK (("species" = ANY (ARRAY['cat'::"text", 'dog'::"text"]))),
    CONSTRAINT "pets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'published'::"text", 'rejected'::"text"])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "nickname" "text" DEFAULT '同学'::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "lost_pet_broadcast" boolean DEFAULT true NOT NULL
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."public_profiles" AS
 SELECT "id",
    "nickname",
    "avatar_url",
    "role",
    "last_seen_at"
   FROM "public"."profiles";


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reporter_name" "text",
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "target_title" "text",
    "reason" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "handle_result" "text",
    "handled_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "handled_at" timestamp with time zone
);


--
-- Name: sightings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."sightings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "location_name" "text" NOT NULL,
    "sighted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reporter_name" "text",
    "remark" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location" "text",
    "recorder_name" "text",
    "notes" "text",
    "photo_url" "text",
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL
);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'admin_audit_logs_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'admin_audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions adoptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'adoptions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."adoptions"
    ADD CONSTRAINT "adoptions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'chat_messages_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'chat_sessions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'chat_sessions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'favorites_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites favorites_user_id_pet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'favorites_user_id_pet_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_pet_id_key" UNIQUE ("user_id", "pet_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans feeding_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feeding_plans_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feeding_plans"
    ADD CONSTRAINT "feeding_plans_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings feedings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feedings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feedings"
    ADD CONSTRAINT "feedings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues lost_pet_clues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pet_clues_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pet_clues"
    ADD CONSTRAINT "lost_pet_clues_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets lost_pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pets_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pets"
    ADD CONSTRAINT "lost_pets_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'pets_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'reports_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'reports'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings sightings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sightings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sightings"
    ADD CONSTRAINT "sightings_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans uq_feeding_plans_pet; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'uq_feeding_plans_pet'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feeding_plans"
    ADD CONSTRAINT "uq_feeding_plans_pet" UNIQUE ("pet_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: idx_adoptions_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_adoptions_pet" ON "public"."adoptions" USING "btree" ("pet_id", "created_at" DESC);


--
-- Name: idx_adoptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_adoptions_user" ON "public"."adoptions" USING "btree" ("user_id", "created_at" DESC);


--
-- Name: idx_chat_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_chat_messages_session" ON "public"."chat_messages" USING "btree" ("session_id", "created_at");


--
-- Name: idx_chat_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_chat_sessions_user" ON "public"."chat_sessions" USING "btree" ("user_id", "updated_at" DESC);


--
-- Name: idx_comments_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_comments_pet" ON "public"."comments" USING "btree" ("pet_id", "created_at" DESC);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_favorites_user" ON "public"."favorites" USING "btree" ("user_id");


--
-- Name: idx_feedings_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_feedings_pet" ON "public"."feedings" USING "btree" ("pet_id", "fed_at" DESC);


--
-- Name: idx_lost_pet_clues_lost_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_lost_pet_clues_lost_pet" ON "public"."lost_pet_clues" USING "btree" ("lost_pet_id", "created_at" DESC);


--
-- Name: idx_lost_pets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_lost_pets_created_at" ON "public"."lost_pets" USING "btree" ("created_at" DESC);


--
-- Name: idx_lost_pets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_lost_pets_status" ON "public"."lost_pets" USING "btree" ("status");


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_notifications_recipient" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);


--
-- Name: idx_pets_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_pets_author" ON "public"."pets" USING "btree" ("author_id");


--
-- Name: idx_pets_discovered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_pets_discovered" ON "public"."pets" USING "btree" ("discovered_at" DESC);


--
-- Name: idx_sightings_pet_sighted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_sightings_pet_sighted" ON "public"."sightings" USING "btree" ("pet_id", "sighted_at" DESC);


--
-- Name: idx_sightings_sighted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_sightings_sighted_at" ON "public"."sightings" USING "btree" ("sighted_at" DESC);


--
-- Name: lost_pets trg_lost_pet_broadcast; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_lost_pet_broadcast" AFTER INSERT ON "public"."lost_pets" FOR EACH ROW EXECUTE FUNCTION "public"."notify_lost_pet_broadcast"();


--
-- Name: adoptions trg_notify_adoption; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_notify_adoption" AFTER INSERT ON "public"."adoptions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_adoption"();


--
-- Name: comments trg_notify_comment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_notify_comment" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_comment"();


--
-- Name: favorites trg_notify_favorite; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_notify_favorite" AFTER INSERT ON "public"."favorites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_favorite"();


--
-- Name: pets trg_notify_pet_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_notify_pet_review" AFTER UPDATE ON "public"."pets" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_pet_review"();


--
-- Name: sightings trg_sync_sighting_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trg_sync_sighting_columns" BEFORE INSERT OR UPDATE ON "public"."sightings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_sighting_columns"();


--
-- Name: profiles trigger_protect_profile_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "trigger_protect_profile_role" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_role"();


--
-- Name: adoptions adoptions_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'adoptions_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."adoptions"
    ADD CONSTRAINT "adoptions_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions adoptions_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'adoptions_reviewer_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."adoptions"
    ADD CONSTRAINT "adoptions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions adoptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'adoptions_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."adoptions"
    ADD CONSTRAINT "adoptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'chat_messages_session_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'comments_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites favorites_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'favorites_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'favorites_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans feeding_plans_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feeding_plans_confirmed_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feeding_plans"
    ADD CONSTRAINT "feeding_plans_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans feeding_plans_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feeding_plans_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feeding_plans"
    ADD CONSTRAINT "feeding_plans_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings feedings_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feedings_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feedings"
    ADD CONSTRAINT "feedings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings feedings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'feedings_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."feedings"
    ADD CONSTRAINT "feedings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues lost_pet_clues_lost_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pet_clues_lost_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pet_clues"
    ADD CONSTRAINT "lost_pet_clues_lost_pet_id_fkey" FOREIGN KEY ("lost_pet_id") REFERENCES "public"."lost_pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues lost_pet_clues_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pet_clues_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pet_clues"
    ADD CONSTRAINT "lost_pet_clues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets lost_pets_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pets_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pets"
    ADD CONSTRAINT "lost_pets_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets lost_pets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'lost_pets_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."lost_pets"
    ADD CONSTRAINT "lost_pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_actor_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'notifications_recipient_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets pets_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'pets_author_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings sightings_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sightings_pet_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sightings"
    ADD CONSTRAINT "sightings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings sightings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'sightings_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."sightings"
    ADD CONSTRAINT "sightings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets Admins can update pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can update pets'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can update pets" ON "public"."pets" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_audit_logs Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can view all audit logs'
      AND n.nspname = 'public'
      AND c.relname = 'admin_audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can view all audit logs" ON "public"."admin_audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: reports Admins can view and update all reports; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins can view and update all reports'
      AND n.nspname = 'public'
      AND c.relname = 'reports'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins can view and update all reports" ON "public"."reports" TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Admins have full access to profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins have full access to profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins have full access to profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings Anyone can insert sightings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can insert sightings'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can insert sightings" ON "public"."sightings" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Anyone can view comments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view comments'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view comments" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings Anyone can view feedings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view feedings'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view feedings" ON "public"."feedings" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues Anyone can view lost pet clues; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view lost pet clues'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view lost pet clues" ON "public"."lost_pet_clues" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets Anyone can view lost pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view lost pets'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view lost pets" ON "public"."lost_pets" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings Anyone can view sightings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone can view sightings'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone can view sightings" ON "public"."sightings" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions Authenticated users can apply adoption; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can apply adoption'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can apply adoption" ON "public"."adoptions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings Authenticated users can check in feeding; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can check in feeding'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can check in feeding" ON "public"."feedings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Authenticated users can comment; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can comment'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can comment" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues Authenticated users can create clues; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can create clues'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can create clues" ON "public"."lost_pet_clues" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets Authenticated users can create lost pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can create lost pets'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can create lost pets" ON "public"."lost_pets" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets Authenticated users can create pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can create pets'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can create pets" ON "public"."pets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "author_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets Authenticated users can delete pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can delete pets'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can delete pets" ON "public"."pets" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Authenticated users can insert notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can insert notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can insert notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets Authenticated users can update pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users can update pets'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users can update pets" ON "public"."pets" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans Authenticated users upsert feeding_plans; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated users upsert feeding_plans'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authenticated users upsert feeding_plans" ON "public"."feeding_plans" TO "authenticated" USING (true) WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pets Authors and admins can update lost pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authors and admins can update lost pets'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Authors and admins can update lost pets" ON "public"."lost_pets" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: lost_pet_clues Clue authors and admins can update clues; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Clue authors and admins can update clues'
      AND n.nspname = 'public'
      AND c.relname = 'lost_pet_clues'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Clue authors and admins can update clues" ON "public"."lost_pet_clues" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions Pet authors can update adoptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Pet authors can update adoptions'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Pet authors can update adoptions" ON "public"."adoptions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "adoptions"."pet_id") AND ("p"."author_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "adoptions"."pet_id") AND ("p"."author_id" = "auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feeding_plans Public read feeding_plans; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read feeding_plans'
      AND n.nspname = 'public'
      AND c.relname = 'feeding_plans'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Public read feeding_plans" ON "public"."feeding_plans" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_audit_logs System can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'System can insert audit logs'
      AND n.nspname = 'public'
      AND c.relname = 'admin_audit_logs'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "System can insert audit logs" ON "public"."admin_audit_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"("auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites Users can add favorites; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can add favorites'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can add favorites" ON "public"."favorites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can create reports'
      AND n.nspname = 'public'
      AND c.relname = 'reports'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions Users can delete own adoptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own adoptions'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own adoptions" ON "public"."adoptions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own comments'
      AND n.nspname = 'public'
      AND c.relname = 'comments'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites Users can delete own favorites; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own favorites'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own favorites" ON "public"."favorites" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: feedings Users can delete own feedings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own feedings'
      AND n.nspname = 'public'
      AND c.relname = 'feedings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own feedings" ON "public"."feedings" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "recipient_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings Users can delete own sightings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own sightings'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can delete own sightings" ON "public"."sightings" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update own notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "recipient_id")) WITH CHECK (("auth"."uid"() = "recipient_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: sightings Users can update own sightings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update own sightings'
      AND n.nspname = 'public'
      AND c.relname = 'sightings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update own sightings" ON "public"."sightings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((NOT ("role" IS DISTINCT FROM "public"."get_user_role"("auth"."uid"()))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: favorites Users can view own favorites; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own favorites'
      AND n.nspname = 'public'
      AND c.relname = 'favorites'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own favorites" ON "public"."favorites" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own notifications'
      AND n.nspname = 'public'
      AND c.relname = 'notifications'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "recipient_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: reports Users can view own reports; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view own reports'
      AND n.nspname = 'public'
      AND c.relname = 'reports'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view own reports" ON "public"."reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: adoptions Users can view related adoptions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view related adoptions'
      AND n.nspname = 'public'
      AND c.relname = 'adoptions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view related adoptions" ON "public"."adoptions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."pets" "p"
  WHERE (("p"."id" = "adoptions"."pet_id") AND ("p"."author_id" = "auth"."uid"()))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can view their own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: pets View published or own pets; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'View published or own pets'
      AND n.nspname = 'public'
      AND c.relname = 'pets'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "View published or own pets" ON "public"."pets" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"text") OR (("auth"."uid"() IS NOT NULL) AND (("author_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: adoptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."adoptions" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages chat_messages_delete_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_messages_delete_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_messages_delete_own" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_messages chat_messages_insert_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_messages_insert_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_messages_insert_own" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_messages chat_messages_select_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_messages_select_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_messages_select_own" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_messages chat_messages_update_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_messages_update_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_messages_update_own" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions chat_sessions_delete_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_sessions_delete_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_sessions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_sessions_delete_own" ON "public"."chat_sessions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_sessions chat_sessions_insert_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_sessions_insert_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_sessions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_sessions_insert_own" ON "public"."chat_sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_sessions chat_sessions_select_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_sessions_select_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_sessions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_sessions_select_own" ON "public"."chat_sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: chat_sessions chat_sessions_update_own; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_sessions_update_own'
      AND n.nspname = 'public'
      AND c.relname = 'chat_sessions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "chat_sessions_update_own" ON "public"."chat_sessions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: feeding_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."feeding_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: feedings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."feedings" ENABLE ROW LEVEL SECURITY;

--
-- Name: lost_pet_clues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lost_pet_clues" ENABLE ROW LEVEL SECURITY;

--
-- Name: lost_pets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."lost_pets" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: pets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: sightings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."sightings" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_created
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;
-- policy: "Authenticated can upload pet photos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Authenticated can upload pet photos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated can upload pet photos" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''pet-photos''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public can view pet photos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public can view pet photos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public can view pet photos" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''pet-photos''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Users can delete own pet photos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can delete own pet photos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete own pet photos" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = ''pet-photos''::text) AND (owner = auth.uid())));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Users can update own pet photos" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users can update own pet photos'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own pet photos" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = ''pet-photos''::text) AND (owner = auth.uid())));';
  END IF;
END
$pg_schema_restore$;
-- policy: chat_images_delete on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_images_delete'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY chat_images_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = ''chat-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: chat_images_insert on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_images_insert'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY chat_images_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''chat-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: chat_images_read on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_images_read'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY chat_images_read ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''chat-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: chat_images_update on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'chat_images_update'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY chat_images_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = ''chat-images''::text)) WITH CHECK ((bucket_id = ''chat-images''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: sighting_photos_auth_insert on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sighting_photos_auth_insert'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY sighting_photos_auth_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = ''sighting-photos''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: sighting_photos_public_read on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'sighting_photos_public_read'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY sighting_photos_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''sighting-photos''::text));';
  END IF;
END
$pg_schema_restore$;
-- publication table: supabase_realtime -> public.profiles
DO $pg_schema_restore$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = to_regclass('public.profiles')
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('chat-images', 'chat-images', NULL, '2026-09-10 02:31:46.811282+00', '2026-09-10 02:31:46.811282+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('pet-photos', 'pet-photos', NULL, '2026-09-08 12:38:44.048535+00', '2026-09-08 12:38:44.048535+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('sighting-photos', 'sighting-photos', NULL, '2026-09-11 05:17:15.350052+00', '2026-09-11 05:17:15.350052+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

