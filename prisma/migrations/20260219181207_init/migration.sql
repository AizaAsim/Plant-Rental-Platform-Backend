-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'VENDOR', 'GARDENER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'PASSWORD_RESET', 'PHONE_VERIFY');

-- CreateEnum
CREATE TYPE "MaintenanceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SunlightRequirement" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'INDIRECT');

-- CreateEnum
CREATE TYPE "WaterFrequency" AS ENUM ('DAILY', 'ALTERNATE_DAYS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('RENT', 'BUY', 'MIXED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ORDER', 'RENTAL_EXTENSION', 'SERVICE_BOOKING', 'DEPOSIT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('ACTIVE', 'EXTENDED', 'RETURNED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('SCHEDULED_MAINTENANCE', 'ON_DEMAND', 'FREELANCE_SERVICE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskImageType" AS ENUM ('BEFORE', 'AFTER', 'ISSUE');

-- CreateEnum
CREATE TYPE "DiagnosisSeverity" AS ENUM ('HEALTHY', 'MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "ReviewableType" AS ENUM ('PLANT', 'NURSERY', 'GARDENER');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('TRENDING', 'SEASONAL', 'EDITOR_PICK', 'NEW_ARRIVAL');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'WISHLIST', 'CART_ADD', 'RENT', 'BUY');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'PROCESSED', 'PAID');

-- CreateEnum
CREATE TYPE "EarningType" AS ENUM ('FREELANCE_BOOKING', 'NURSERY_TASK');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('VENDOR', 'GARDENER');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('REFUND', 'QUALITY', 'DELIVERY', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "ApplicableFor" AS ENUM ('ALL', 'RENT', 'BUY', 'SERVICE');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER', 'RENTAL', 'BOOKING', 'TASK', 'PAYMENT', 'PROMOTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "full_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL,
    "is_corporate" BOOLEAN NOT NULL DEFAULT false,
    "company_name" TEXT,
    "gst_number" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "otp_code" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "device_info" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurseries" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "service_radius_km" INTEGER NOT NULL DEFAULT 10,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_working_hours" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT,
    "close_time" TEXT,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursery_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_images" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_service_areas" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursery_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scientific_name" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "care_instructions" TEXT,
    "sunlight_requirement" "SunlightRequirement",
    "water_frequency" "WaterFrequency",
    "maintenance_level" "MaintenanceLevel" NOT NULL,
    "is_indoor" BOOLEAN NOT NULL DEFAULT true,
    "is_pet_friendly" BOOLEAN NOT NULL DEFAULT false,
    "height_cm" INTEGER,
    "pot_included" BOOLEAN NOT NULL DEFAULT true,
    "rent_price_daily" DECIMAL(10,2),
    "rent_price_weekly" DECIMAL(10,2),
    "rent_price_monthly" DECIMAL(10,2),
    "buy_price" DECIMAL(10,2),
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_available_for_rent" BOOLEAN NOT NULL DEFAULT true,
    "is_available_for_sale" BOOLEAN NOT NULL DEFAULT true,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_rent_days" INTEGER NOT NULL DEFAULT 7,
    "max_rent_days" INTEGER NOT NULL DEFAULT 365,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_rentals" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_images" (
    "id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_tag_mapping" (
    "plant_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "plant_tag_mapping_pkey" PRIMARY KEY ("plant_id","tag_id")
);

-- CreateTable
CREATE TABLE "gardeners" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nursery_id" TEXT,
    "bio" TEXT,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(10,2),
    "is_freelancer" BOOLEAN NOT NULL DEFAULT false,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "rating_avg" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gardeners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gardener_skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gardener_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gardener_skill_mapping" (
    "gardener_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,

    CONSTRAINT "gardener_skill_mapping_pkey" PRIMARY KEY ("gardener_id","skill_id")
);

-- CreateTable
CREATE TABLE "gardener_service_areas" (
    "id" TEXT NOT NULL,
    "gardener_id" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "city" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gardener_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gardener_availability" (
    "id" TEXT NOT NULL,
    "gardener_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gardener_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "order_type" "OrderType" NOT NULL,
    "rent_start_date" DATE,
    "rent_end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "delivery_address_id" TEXT NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deposit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "notes" TEXT,
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "deposit_per_unit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(10,2) NOT NULL,
    "rent_start_date" DATE,
    "rent_end_date" DATE,
    "rental_status" "RentalStatus",
    "actual_return_date" DATE,
    "extension_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "original_end_date" DATE NOT NULL,
    "new_end_date" DATE NOT NULL,
    "extension_price" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_gateway" TEXT,
    "gateway_transaction_id" TEXT,
    "gateway_order_id" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "refund_amount" DECIMAL(10,2),
    "refunded_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_bookings" (
    "id" TEXT NOT NULL,
    "booking_number" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gardener_id" TEXT NOT NULL,
    "service_address_id" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "service_date" DATE NOT NULL,
    "service_time" TEXT NOT NULL,
    "duration_hours" DECIMAL(4,2) NOT NULL,
    "recurrence_pattern" "RecurrencePattern",
    "recurrence_end_date" DATE,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "task_number" TEXT NOT NULL,
    "order_item_id" TEXT,
    "booking_id" TEXT,
    "nursery_id" TEXT,
    "gardener_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_type" "TaskType" NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "scheduled_time" TEXT,
    "address_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "gardener_notes" TEXT,
    "completion_notes" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_images" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_type" "TaskImageType" NOT NULL,
    "caption" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_diagnoses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plant_id" TEXT,
    "image_url" TEXT NOT NULL,
    "diagnosis_result" JSONB NOT NULL,
    "disease_detected" TEXT,
    "confidence_score" DECIMAL(5,4),
    "care_suggestions" TEXT,
    "severity" "DiagnosisSeverity",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plant_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "context_plant_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reviewable_type" "ReviewableType" NOT NULL,
    "reviewable_id" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_plants" (
    "id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "feature_type" "FeatureType" NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_plant_interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "interaction_type" "InteractionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_plant_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_earnings" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_amount" DECIMAL(10,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "net_earnings" DECIMAL(10,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gardener_earnings" (
    "id" TEXT NOT NULL,
    "gardener_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "task_id" TEXT,
    "earning_type" "EarningType" NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "commission_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_earnings" DECIMAL(10,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gardener_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "payout_number" TEXT NOT NULL,
    "recipient_type" "RecipientType" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "bank_reference" TEXT,
    "processed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "dispute_number" TEXT NOT NULL,
    "raised_by" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "dispute_type" "DisputeType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_messages" (
    "id" TEXT NOT NULL,
    "dispute_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "max_discount_amount" DECIMAL(10,2),
    "applicable_for" "ApplicableFor" NOT NULL DEFAULT 'ALL',
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usage" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "booking_id" TEXT,
    "discount_applied" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_details" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "nurseries_vendor_id_key" ON "nurseries"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "nurseries_slug_key" ON "nurseries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "nursery_service_areas_nursery_id_pincode_key" ON "nursery_service_areas"("nursery_id", "pincode");

-- CreateIndex
CREATE UNIQUE INDEX "plant_categories_slug_key" ON "plant_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plants_nursery_id_slug_key" ON "plants"("nursery_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "plant_tags_name_key" ON "plant_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "gardeners_user_id_key" ON "gardeners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gardener_skills_name_key" ON "gardener_skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "gardener_service_areas_gardener_id_pincode_key" ON "gardener_service_areas"("gardener_id", "pincode");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_plant_id_order_type_key" ON "cart_items"("cart_id", "plant_id", "order_type");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "service_bookings_booking_number_key" ON "service_bookings"("booking_number");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_tasks_task_number_key" ON "maintenance_tasks"("task_number");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_reviewable_type_reviewable_id_order_id_key" ON "reviews"("user_id", "reviewable_type", "reviewable_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_plant_id_key" ON "wishlists"("user_id", "plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_token_key" ON "device_tokens"("user_id", "token");

-- CreateIndex
CREATE INDEX "user_plant_interactions_user_id_created_at_idx" ON "user_plant_interactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_payout_number_key" ON "payouts"("payout_number");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_dispute_number_key" ON "disputes"("dispute_number");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_working_hours" ADD CONSTRAINT "nursery_working_hours_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_images" ADD CONSTRAINT "nursery_images_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_service_areas" ADD CONSTRAINT "nursery_service_areas_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_categories" ADD CONSTRAINT "plant_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "plant_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "plant_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_images" ADD CONSTRAINT "plant_images_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_tag_mapping" ADD CONSTRAINT "plant_tag_mapping_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_tag_mapping" ADD CONSTRAINT "plant_tag_mapping_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "plant_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardeners" ADD CONSTRAINT "gardeners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardeners" ADD CONSTRAINT "gardeners_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_skill_mapping" ADD CONSTRAINT "gardener_skill_mapping_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_skill_mapping" ADD CONSTRAINT "gardener_skill_mapping_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "gardener_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_service_areas" ADD CONSTRAINT "gardener_service_areas_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_availability" ADD CONSTRAINT "gardener_availability_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_address_id_fkey" FOREIGN KEY ("service_address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_images" ADD CONSTRAINT "task_images_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_images" ADD CONSTRAINT "task_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_diagnoses" ADD CONSTRAINT "plant_diagnoses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_diagnoses" ADD CONSTRAINT "plant_diagnoses_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_plants" ADD CONSTRAINT "featured_plants_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_interactions" ADD CONSTRAINT "user_plant_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_interactions" ADD CONSTRAINT "user_plant_interactions_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earnings" ADD CONSTRAINT "vendor_earnings_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earnings" ADD CONSTRAINT "vendor_earnings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earnings" ADD CONSTRAINT "vendor_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_earnings" ADD CONSTRAINT "gardener_earnings_gardener_id_fkey" FOREIGN KEY ("gardener_id") REFERENCES "gardeners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_earnings" ADD CONSTRAINT "gardener_earnings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_earnings" ADD CONSTRAINT "gardener_earnings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gardener_earnings" ADD CONSTRAINT "gardener_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
