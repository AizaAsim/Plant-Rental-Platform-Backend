.PHONY: create-volumes

create-volumes:
	docker volume create api_postgres_data
	docker volume create api_redis_data
