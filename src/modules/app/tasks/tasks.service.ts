// src/modules/app/tasks/tasks.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, TaskStatus, TaskType, TaskPriority, TaskImageType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private generateTaskNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TASK-${timestamp}-${random}`;
  }

  // GET /api/v1/tasks
  async getGardenerTasks(gardenerId: string, filterDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const {
      page = 1,
      limit = 20,
      status,
      task_type,
      date_from,
      date_to,
      priority,
    } = filterDto;

    const where: Prisma.MaintenanceTaskWhereInput = {
      gardenerId: gardener.id,
      ...(status && { status }),
      ...(task_type && { taskType: task_type }),
      ...(date_from && { scheduledDate: { gte: new Date(date_from) } }),
      ...(date_to && { scheduledDate: { lte: new Date(date_to) } }),
      ...(priority && { priority }),
    };

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where,
        skip,
        take: limit,
        include: {
          orderItem: {
            include: {
              plant: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
            },
          },
          address: true,
          images: {
            take: 3,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [
          { scheduledDate: "asc" },
          { scheduledTime: "asc" },
        ],
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return {
      items: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/tasks/{task_id}
  async getTaskById(userId: string, taskId: string, userRole: string) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id: taskId },
      include: {
        orderItem: {
          include: {
            plant: {
              include: {
                images: true,
                nursery: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        booking: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        nursery: true,
        gardener: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        address: true,
        images: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Check access
    if (userRole === "GARDENER") {
      const gardener = await this.prisma.gardener.findUnique({
        where: { userId },
      });
      if (!gardener || gardener.id !== task.gardenerId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === "VENDOR") {
      if (!task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
      const nursery = await this.prisma.nursery.findUnique({
        where: { vendorId: userId },
      });
      if (!nursery || nursery.id !== task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === "USER") {
      if (task.userId !== userId) {
        throw new ForbiddenException("Access denied");
      }
    }

    return task;
  }

  // POST /api/v1/tasks/{task_id}/accept
  async acceptTask(gardenerId: string, taskId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        gardenerId: gardener.id,
        status: TaskStatus.ASSIGNED,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be accepted");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.ACCEPTED,
      },
      include: {
        orderItem: {
          include: {
            plant: true,
          },
        },
        address: true,
      },
    });

    // TODO: Notify nursery/user

    return updated;
  }

  // POST /api/v1/tasks/{task_id}/reject
  async rejectTask(gardenerId: string, taskId: string, rejectDto: any) {
    const { reason } = rejectDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        gardenerId: gardener.id,
        status: TaskStatus.ASSIGNED,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be rejected");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.REJECTED,
        gardenerNotes: reason,
      },
    });

    // TODO: Notify nursery to reassign

    return updated;
  }

  // POST /api/v1/tasks/{task_id}/start
  async startTask(gardenerId: string, taskId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        gardenerId: gardener.id,
        status: {
          in: [TaskStatus.ACCEPTED, TaskStatus.ASSIGNED],
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be started");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    return updated;
  }

  // POST /api/v1/tasks/{task_id}/complete
  async completeTask(gardenerId: string, taskId: string, completeDto: any) {
    const { completion_notes, issues_found } = completeDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        gardenerId: gardener.id,
        status: TaskStatus.IN_PROGRESS,
      },
      include: {
        orderItem: true,
        booking: true,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be completed");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completionNotes: completion_notes,
        gardenerNotes: issues_found ? `${task.gardenerNotes || ""}\nIssues found: ${issues_found}`.trim() : task.gardenerNotes,
      },
    });

    // Create gardener earnings if from scheduled maintenance (nursery task)
    if (task.taskType === "SCHEDULED_MAINTENANCE" && task.orderItemId) {
      // Calculate earnings (would need to check nursery settings for rate)
      const grossAmount = new Decimal(500); // Default rate, should come from nursery settings
      const commissionRate = new Decimal(0.1); // 10% commission
      const commissionAmount = grossAmount.times(commissionRate);
      const netEarnings = grossAmount.minus(commissionAmount);

      await this.prisma.gardenerEarning.create({
        data: {
          gardenerId: gardener.id,
          taskId: task.id,
          earningType: "NURSERY_TASK",
          grossAmount: grossAmount,
          commissionRate: commissionRate,
          commissionAmount: commissionAmount,
          netEarnings: netEarnings,
          status: "PENDING",
        },
      });
    }

    // If issues found, flag for plant doctor
    if (issues_found) {
      // Create plant diagnosis request
      if (task.orderItemId && task.orderItem?.plantId) {
        await this.prisma.plantDiagnosis.create({
          data: {
            userId: task.userId,
            plantId: task.orderItem.plantId,
            imageUrl: "", // Would be from task images
            diagnosisResult: {},
            diseaseDetected: issues_found,
            severity: "MODERATE", // Default, would be determined by AI
          },
        });
      }
    }

    // TODO: Notify user/nursery

    return updated;
  }

  // POST /api/v1/tasks/{task_id}/images
  async uploadTaskImages(gardenerId: string, taskId: string, imagesDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        gardenerId: gardener.id,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const { images } = imagesDto;

    const createdImages = await Promise.all(
      images.map((img: any) =>
        this.prisma.taskImage.create({
          data: {
            taskId: taskId,
            imageUrl: img.image_url,
            imageType: img.image_type,
            caption: img.caption,
            uploadedBy: gardenerId,
          },
        })
      )
    );

    // Auto-send ISSUE images to plant doctor
    const issueImages = images.filter((img: any) => img.image_type === "ISSUE");
    if (issueImages.length > 0 && task.orderItemId) {
      const taskWithPlant = await this.prisma.maintenanceTask.findUnique({
        where: { id: taskId },
        include: {
          orderItem: {
            include: {
              plant: true,
            },
          },
        },
      });

      if (taskWithPlant?.orderItem?.plantId) {
        for (const issueImg of issueImages) {
          await this.prisma.plantDiagnosis.create({
            data: {
              userId: task.userId,
              plantId: taskWithPlant.orderItem.plantId,
              imageUrl: issueImg.image_url,
              diagnosisResult: {},
              severity: "MODERATE", // Would be determined by AI
            },
          });
        }
      }
    }

    return createdImages;
  }

  // GET /api/v1/tasks/{task_id}/images
  async getTaskImages(userId: string, taskId: string, userRole: string) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Check access (same logic as getTaskById)
    if (userRole === "GARDENER") {
      const gardener = await this.prisma.gardener.findUnique({
        where: { userId },
      });
      if (!gardener || gardener.id !== task.gardenerId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === "VENDOR") {
      if (!task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
      const nursery = await this.prisma.nursery.findUnique({
        where: { vendorId: userId },
      });
      if (!nursery || nursery.id !== task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === "USER") {
      if (task.userId !== userId) {
        throw new ForbiddenException("Access denied");
      }
    }

    const images = await this.prisma.taskImage.findMany({
      where: { taskId },
      include: {
        uploader: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return images;
  }

  // ========== VENDOR TASK MANAGEMENT ==========

  // GET /api/v1/vendor/tasks
  async getVendorTasks(vendorId: string, filterDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const {
      page = 1,
      limit = 20,
      status,
      gardener_id,
      date_from,
      date_to,
    } = filterDto;

    const where: Prisma.MaintenanceTaskWhereInput = {
      nurseryId: nursery.id,
      ...(status && { status }),
      ...(gardener_id && { gardenerId: gardener_id }),
      ...(date_from && { scheduledDate: { gte: new Date(date_from) } }),
      ...(date_to && { scheduledDate: { lte: new Date(date_to) } }),
    };

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where,
        skip,
        take: limit,
        include: {
          orderItem: {
            include: {
              plant: true,
              order: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
          gardener: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
          address: true,
        },
        orderBy: { scheduledDate: "desc" },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return {
      items: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // POST /api/v1/vendor/tasks
  async createTask(vendorId: string, createDto: any) {
    const {
      order_item_id,
      gardener_id,
      scheduled_date,
      scheduled_time,
      priority,
      description,
    } = createDto;

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
      include: {
        gardeners: true,
      },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Validate gardener belongs to nursery
    const gardener = nursery.gardeners.find((g) => g.id === gardener_id);
    if (!gardener) {
      throw new BadRequestException("Gardener does not belong to this nursery");
    }

    // Validate order item
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: order_item_id },
      include: {
        order: true,
        plant: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException("Order item not found");
    }

    if (orderItem.order.nurseryId !== nursery.id) {
      throw new BadRequestException("Order item does not belong to this nursery");
    }

    if (orderItem.orderType !== "RENT") {
      throw new BadRequestException("Can only create tasks for rental items");
    }

    if (!["ACTIVE", "EXTENDED"].includes(orderItem.rentalStatus || "")) {
      throw new BadRequestException("Order item is not an active rental");
    }

    // Get user address from order
    const address = await this.prisma.userAddress.findFirst({
      where: {
        userId: orderItem.order.userId,
        isDefault: true,
      },
    });

    if (!address) {
      throw new NotFoundException("User address not found");
    }

    // Create task
    const task = await this.prisma.maintenanceTask.create({
      data: {
        taskNumber: this.generateTaskNumber(),
        orderItemId: order_item_id,
        nurseryId: nursery.id,
        gardenerId: gardener_id,
        userId: orderItem.order.userId,
        addressId: address.id,
        taskType: "SCHEDULED_MAINTENANCE",
        scheduledDate: new Date(scheduled_date),
        scheduledTime: scheduled_time,
        priority: priority || TaskPriority.MEDIUM,
        description,
        status: TaskStatus.ASSIGNED,
      },
      include: {
        orderItem: {
          include: {
            plant: true,
          },
        },
        gardener: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        address: true,
      },
    });

    // TODO: Notify gardener

    return task;
  }

  // PUT /api/v1/vendor/tasks/{task_id}/reassign
  async reassignTask(vendorId: string, taskId: string, reassignDto: any) {
    const { gardener_id } = reassignDto;

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
      include: {
        gardeners: true,
      },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        nurseryId: nursery.id,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.status === TaskStatus.IN_PROGRESS) {
      throw new BadRequestException("Cannot reassign task in progress");
    }

    // Validate new gardener belongs to nursery
    const gardener = nursery.gardeners.find((g) => g.id === gardener_id);
    if (!gardener) {
      throw new BadRequestException("Gardener does not belong to this nursery");
    }

    const oldGardenerId = task.gardenerId;

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        gardenerId: gardener_id,
        status: TaskStatus.ASSIGNED,
      },
      include: {
        gardener: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // TODO: Notify both gardeners

    return updated;
  }

  // PUT /api/v1/vendor/tasks/{task_id}/reschedule
  async rescheduleTask(vendorId: string, taskId: string, rescheduleDto: any) {
    const { scheduled_date, scheduled_time } = rescheduleDto;

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        nurseryId: nursery.id,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const updateData: Prisma.MaintenanceTaskUpdateInput = {};
    if (scheduled_date) {
      updateData.scheduledDate = new Date(scheduled_date);
    }
    if (scheduled_time !== undefined) {
      updateData.scheduledTime = scheduled_time;
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: updateData,
    });

    // TODO: Notify gardener

    return updated;
  }

  // POST /api/v1/vendor/tasks/{task_id}/cancel
  async cancelTask(vendorId: string, taskId: string, cancelDto: any) {
    const { reason } = cancelDto;

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: {
        id: taskId,
        nurseryId: nursery.id,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException("Cannot cancel completed task");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
        gardenerNotes: reason,
      },
    });

    // TODO: Notify gardener and user

    return updated;
  }

  // ========== USER TASK VIEW ==========

  // GET /api/v1/user/tasks
  async getUserTasks(userId: string, filterDto: any) {
    const {
      page = 1,
      limit = 20,
      status,
      date_from,
      date_to,
    } = filterDto;

    const where: Prisma.MaintenanceTaskWhereInput = {
      userId,
      ...(status && { status }),
      ...(date_from && { scheduledDate: { gte: new Date(date_from) } }),
      ...(date_to && { scheduledDate: { lte: new Date(date_to) } }),
    };

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      this.prisma.maintenanceTask.findMany({
        where,
        skip,
        take: limit,
        include: {
          orderItem: {
            include: {
              plant: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          gardener: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  avatarUrl: true,
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
            },
          },
          address: true,
          images: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { scheduledDate: "desc" },
      }),
      this.prisma.maintenanceTask.count({ where }),
    ]);

    return {
      items: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
