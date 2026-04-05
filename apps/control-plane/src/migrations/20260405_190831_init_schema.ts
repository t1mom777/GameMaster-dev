import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_admins_role" AS ENUM('owner', 'operator');
  CREATE TYPE "public"."enum_players_preferred_voice_mode" AS ENUM('auto-vad', 'push-to-talk', 'text-only');
  CREATE TYPE "public"."enum_documents_kind" AS ENUM('primary-rulebook', 'supporting-book', 'lore-pack');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('uploaded', 'indexing', 'ready', 'error');
  CREATE TYPE "public"."enum_game_sessions_status" AS ENUM('scheduled', 'live', 'ended');
  CREATE TYPE "public"."enum_provider_connections_provider" AS ENUM('gemini', 'openai', 'deepgram', 'livekit');
  CREATE TYPE "public"."enum_runtime_defaults_llm_provider" AS ENUM('gemini', 'openai');
  CREATE TYPE "public"."enum_runtime_defaults_stt_provider" AS ENUM('deepgram', 'openai');
  CREATE TYPE "public"."enum_runtime_defaults_tts_provider" AS ENUM('deepgram', 'openai');
  CREATE TYPE "public"."enum_runtime_defaults_voice_mode" AS ENUM('auto-vad', 'push-to-talk');
  CREATE TABLE "admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_admins_role" DEFAULT 'owner' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "players" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"preferred_voice_mode" "enum_players_preferred_voice_mode" DEFAULT 'auto-vad',
  	"last_seen_at" timestamp(3) with time zone,
  	"last_room_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaigns_table_expectations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"expectation" varchar NOT NULL
  );
  
  CREATE TABLE "campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"pitch" varchar,
  	"primary_ruleset_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "worlds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"campaign_id" integer,
  	"tone" varchar,
  	"player_promise" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rulesets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"campaign_id" integer,
  	"summary" varchar,
  	"primary_rulebook_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rulesets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"documents_id" integer
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_documents_kind" DEFAULT 'supporting-book' NOT NULL,
  	"status" "enum_documents_status" DEFAULT 'uploaded' NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"is_primary" boolean DEFAULT false,
  	"ruleset_id" integer,
  	"session_id" integer,
  	"reindex_requested" boolean DEFAULT false,
  	"chunk_count" numeric,
  	"last_ingested_at" timestamp(3) with time zone,
  	"ingest_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "game_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_game_sessions_status" DEFAULT 'scheduled' NOT NULL,
  	"room_name" varchar NOT NULL,
  	"allow_guests" boolean DEFAULT true,
  	"public_join_enabled" boolean DEFAULT true,
  	"scheduled_for" timestamp(3) with time zone,
  	"campaign_id" integer,
  	"world_id" integer,
  	"ruleset_id" integer,
  	"public_summary" varchar,
  	"welcome_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "game_sessions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"documents_id" integer
  );
  
  CREATE TABLE "provider_connections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"provider" "enum_provider_connections_provider" DEFAULT 'gemini' NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"llm_model" varchar,
  	"stt_model" varchar,
  	"tts_model" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" integer,
  	"players_id" integer,
  	"campaigns_id" integer,
  	"worlds_id" integer,
  	"rulesets_id" integer,
  	"documents_id" integer,
  	"game_sessions_id" integer,
  	"provider_connections_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "runtime_defaults" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"system_prompt" varchar DEFAULT 'You are the GameMaster. Run a vivid, fast-moving tabletop RPG session. Respect the current campaign tone, stay grounded in the active rulebooks, and keep responses speakable for voice output.' NOT NULL,
  	"llm_provider" "enum_runtime_defaults_llm_provider" DEFAULT 'gemini',
  	"llm_model" varchar DEFAULT 'gemini-2.5-flash',
  	"stt_provider" "enum_runtime_defaults_stt_provider" DEFAULT 'deepgram',
  	"stt_model" varchar DEFAULT 'nova-3',
  	"tts_provider" "enum_runtime_defaults_tts_provider" DEFAULT 'deepgram',
  	"tts_model" varchar DEFAULT 'aura-2',
  	"tts_voice" varchar DEFAULT 'thalia-en',
  	"voice_mode" "enum_runtime_defaults_voice_mode" DEFAULT 'auto-vad',
  	"retrieval_top_k" numeric DEFAULT 5,
  	"max_participants" numeric DEFAULT 6,
  	"allow_text_fallback" boolean DEFAULT true,
  	"join_greeting" varchar DEFAULT 'Welcome to the table. Introduce the current scene, confirm the player intent, and start with a strong first prompt.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_title" varchar DEFAULT 'GameMaster' NOT NULL,
  	"tagline" varchar DEFAULT 'Voice-first tabletop sessions with admin-grade campaign control.',
  	"public_description" varchar DEFAULT 'Join a room, speak naturally, and let the GM keep the world coherent through active rulebooks and scene memory.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "admins_sessions" ADD CONSTRAINT "admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_table_expectations" ADD CONSTRAINT "campaigns_table_expectations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_primary_ruleset_id_rulesets_id_fk" FOREIGN KEY ("primary_ruleset_id") REFERENCES "public"."rulesets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "worlds" ADD CONSTRAINT "worlds_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_primary_rulebook_id_documents_id_fk" FOREIGN KEY ("primary_rulebook_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rulesets_rels" ADD CONSTRAINT "rulesets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."rulesets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rulesets_rels" ADD CONSTRAINT "rulesets_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_ruleset_id_rulesets_id_fk" FOREIGN KEY ("ruleset_id") REFERENCES "public"."rulesets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_ruleset_id_rulesets_id_fk" FOREIGN KEY ("ruleset_id") REFERENCES "public"."rulesets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "game_sessions_rels" ADD CONSTRAINT "game_sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "game_sessions_rels" ADD CONSTRAINT "game_sessions_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_players_fk" FOREIGN KEY ("players_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_worlds_fk" FOREIGN KEY ("worlds_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rulesets_fk" FOREIGN KEY ("rulesets_id") REFERENCES "public"."rulesets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_game_sessions_fk" FOREIGN KEY ("game_sessions_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_provider_connections_fk" FOREIGN KEY ("provider_connections_id") REFERENCES "public"."provider_connections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admins_sessions_order_idx" ON "admins_sessions" USING btree ("_order");
  CREATE INDEX "admins_sessions_parent_id_idx" ON "admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");
  CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");
  CREATE INDEX "players_updated_at_idx" ON "players" USING btree ("updated_at");
  CREATE INDEX "players_created_at_idx" ON "players" USING btree ("created_at");
  CREATE INDEX "campaigns_table_expectations_order_idx" ON "campaigns_table_expectations" USING btree ("_order");
  CREATE INDEX "campaigns_table_expectations_parent_id_idx" ON "campaigns_table_expectations" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "campaigns_slug_idx" ON "campaigns" USING btree ("slug");
  CREATE INDEX "campaigns_primary_ruleset_idx" ON "campaigns" USING btree ("primary_ruleset_id");
  CREATE INDEX "campaigns_updated_at_idx" ON "campaigns" USING btree ("updated_at");
  CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");
  CREATE UNIQUE INDEX "worlds_slug_idx" ON "worlds" USING btree ("slug");
  CREATE INDEX "worlds_campaign_idx" ON "worlds" USING btree ("campaign_id");
  CREATE INDEX "worlds_updated_at_idx" ON "worlds" USING btree ("updated_at");
  CREATE INDEX "worlds_created_at_idx" ON "worlds" USING btree ("created_at");
  CREATE UNIQUE INDEX "rulesets_slug_idx" ON "rulesets" USING btree ("slug");
  CREATE INDEX "rulesets_campaign_idx" ON "rulesets" USING btree ("campaign_id");
  CREATE INDEX "rulesets_primary_rulebook_idx" ON "rulesets" USING btree ("primary_rulebook_id");
  CREATE INDEX "rulesets_updated_at_idx" ON "rulesets" USING btree ("updated_at");
  CREATE INDEX "rulesets_created_at_idx" ON "rulesets" USING btree ("created_at");
  CREATE INDEX "rulesets_rels_order_idx" ON "rulesets_rels" USING btree ("order");
  CREATE INDEX "rulesets_rels_parent_idx" ON "rulesets_rels" USING btree ("parent_id");
  CREATE INDEX "rulesets_rels_path_idx" ON "rulesets_rels" USING btree ("path");
  CREATE INDEX "rulesets_rels_documents_id_idx" ON "rulesets_rels" USING btree ("documents_id");
  CREATE UNIQUE INDEX "documents_slug_idx" ON "documents" USING btree ("slug");
  CREATE INDEX "documents_ruleset_idx" ON "documents" USING btree ("ruleset_id");
  CREATE INDEX "documents_session_idx" ON "documents" USING btree ("session_id");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "documents_filename_idx" ON "documents" USING btree ("filename");
  CREATE UNIQUE INDEX "game_sessions_slug_idx" ON "game_sessions" USING btree ("slug");
  CREATE UNIQUE INDEX "game_sessions_room_name_idx" ON "game_sessions" USING btree ("room_name");
  CREATE INDEX "game_sessions_campaign_idx" ON "game_sessions" USING btree ("campaign_id");
  CREATE INDEX "game_sessions_world_idx" ON "game_sessions" USING btree ("world_id");
  CREATE INDEX "game_sessions_ruleset_idx" ON "game_sessions" USING btree ("ruleset_id");
  CREATE INDEX "game_sessions_updated_at_idx" ON "game_sessions" USING btree ("updated_at");
  CREATE INDEX "game_sessions_created_at_idx" ON "game_sessions" USING btree ("created_at");
  CREATE INDEX "game_sessions_rels_order_idx" ON "game_sessions_rels" USING btree ("order");
  CREATE INDEX "game_sessions_rels_parent_idx" ON "game_sessions_rels" USING btree ("parent_id");
  CREATE INDEX "game_sessions_rels_path_idx" ON "game_sessions_rels" USING btree ("path");
  CREATE INDEX "game_sessions_rels_documents_id_idx" ON "game_sessions_rels" USING btree ("documents_id");
  CREATE UNIQUE INDEX "provider_connections_slug_idx" ON "provider_connections" USING btree ("slug");
  CREATE INDEX "provider_connections_updated_at_idx" ON "provider_connections" USING btree ("updated_at");
  CREATE INDEX "provider_connections_created_at_idx" ON "provider_connections" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_admins_id_idx" ON "payload_locked_documents_rels" USING btree ("admins_id");
  CREATE INDEX "payload_locked_documents_rels_players_id_idx" ON "payload_locked_documents_rels" USING btree ("players_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_worlds_id_idx" ON "payload_locked_documents_rels" USING btree ("worlds_id");
  CREATE INDEX "payload_locked_documents_rels_rulesets_id_idx" ON "payload_locked_documents_rels" USING btree ("rulesets_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_game_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("game_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_provider_connections_id_idx" ON "payload_locked_documents_rels" USING btree ("provider_connections_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admins_id_idx" ON "payload_preferences_rels" USING btree ("admins_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "admins_sessions" CASCADE;
  DROP TABLE "admins" CASCADE;
  DROP TABLE "players" CASCADE;
  DROP TABLE "campaigns_table_expectations" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "worlds" CASCADE;
  DROP TABLE "rulesets" CASCADE;
  DROP TABLE "rulesets_rels" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "game_sessions" CASCADE;
  DROP TABLE "game_sessions_rels" CASCADE;
  DROP TABLE "provider_connections" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "runtime_defaults" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TYPE "public"."enum_admins_role";
  DROP TYPE "public"."enum_players_preferred_voice_mode";
  DROP TYPE "public"."enum_documents_kind";
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum_game_sessions_status";
  DROP TYPE "public"."enum_provider_connections_provider";
  DROP TYPE "public"."enum_runtime_defaults_llm_provider";
  DROP TYPE "public"."enum_runtime_defaults_stt_provider";
  DROP TYPE "public"."enum_runtime_defaults_tts_provider";
  DROP TYPE "public"."enum_runtime_defaults_voice_mode";`)
}
