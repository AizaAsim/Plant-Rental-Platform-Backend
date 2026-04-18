-- User-stored plant recommender preferences (modal on frontend)
CREATE TABLE "user_recommendation_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "light_pref" TEXT NOT NULL,
    "water_pref" TEXT,
    "pet_friendly" BOOLEAN NOT NULL,
    "space" TEXT NOT NULL,
    "top_n" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_recommendation_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_recommendation_preferences_user_id_key" ON "user_recommendation_preferences"("user_id");

ALTER TABLE "user_recommendation_preferences" ADD CONSTRAINT "user_recommendation_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
