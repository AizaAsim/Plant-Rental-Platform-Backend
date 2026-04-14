// src/modules/app/tasks/tasks.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  Prisma,
  TaskStatus,
  TaskType,
  TaskPriority,
  TaskImageType,
  UserRole,
  NotificationType,
  MaintenanceProposalStatus,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private scheduledDateFilter(
    date_from?: string,
    date_to?: string
  ): Prisma.DateTimeFilter | undefined {
    if (!date_from && !date_to) return undefined;
    return {
      ...(date_from ? { gte: new Date(date_from) } : {}),
      ...(date_to ? { lte: new Date(date_to) } : {}),
    };
  }

  private async notify(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    referenceId?: string
  ) {
    await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        referenceType: "TASK",
        referenceId: referenceId ?? null,
      },
    });
  }

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

    const dateFilter = this.scheduledDateFilter(date_from, date_to);
    const where: Prisma.MaintenanceTaskWhereInput = {
      gardenerId: gardener.id,
      ...(status && { status }),
      ...(task_type && { taskType: task_type }),
      ...(dateFilter && { scheduledDate: dateFilter }),
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
  async getTaskById(userId: string, taskId: string, userRole: UserRole) {
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
    if (userRole === UserRole.GARDENER) {
      const gardener = await this.prisma.gardener.findUnique({
        where: { userId },
      });
      if (!gardener || !task.gardenerId || gardener.id !== task.gardenerId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === UserRole.VENDOR) {
      if (!task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
      const nursery = await this.prisma.nursery.findUnique({
        where: { vendorId: userId },
      });
      if (!nursery || nursery.id !== task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === UserRole.USER) {
      if (task.userId !== userId) {
        throw new ForbiddenException("Access denied");
      }
    } else {
      throw new ForbiddenException("Access denied");
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
        nursery: { select: { vendorId: true } },
      },
    });

    await this.notify(
      updated.userId,
      "Maintenance task accepted",
      `Your scheduled maintenance (task ${updated.taskNumber}) was accepted by the gardener.`,
      NotificationType.TASK,
      taskId
    );
    if (updated.nursery?.vendorId) {
      await this.notify(
        updated.nursery.vendorId,
        "Task accepted",
        `Task ${updated.taskNumber} was accepted by the assigned gardener.`,
        NotificationType.TASK,
        taskId
      );
    }

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
      include: { nursery: { select: { vendorId: true } } },
    });

    if (updated.nursery?.vendorId) {
      await this.notify(
        updated.nursery.vendorId,
        "Task rejected — reassign needed",
        `Gardener rejected task ${updated.taskNumber}. Reason: ${reason || "Not specified"}`,
        NotificationType.TASK,
        taskId
      );
    }

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
        status: TaskStatus.ACCEPTED,
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be started (accept it first)");
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
        nursery: { select: { vendorId: true } },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found or cannot be completed");
    }

    const completionNotes =
      [completion_notes, issues_found ? `Issues: ${issues_found}` : ""]
        .filter(Boolean)
        .join("\n")
        .trim() || null;

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completionNotes,
      },
    });

    // Create gardener earnings if from scheduled maintenance (nursery task)
    if (task.taskType === TaskType.SCHEDULED_MAINTENANCE && task.orderItemId) {
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
    const plantId = task.orderItem?.plantId;
    if (issues_found && plantId) {
      await this.prisma.plantDiagnosis.create({
        data: {
          userId: task.userId,
          plantId,
          imageUrl: "pending",
          diagnosisResult: {},
          diseaseDetected: issues_found,
          severity: "MODERATE",
        },
      });
    }

    await this.notify(
      task.userId,
      "Maintenance completed",
      `Task ${task.taskNumber} was completed.${issues_found ? " Issues were reported and forwarded to plant care." : ""}`,
      NotificationType.TASK,
      taskId
    );
    if (task.nursery?.vendorId) {
      await this.notify(
        task.nursery.vendorId,
        "Maintenance completed",
        `Task ${task.taskNumber} was marked completed by the gardener.`,
        NotificationType.TASK,
        taskId
      );
    }

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
    if (!Array.isArray(images) || images.length === 0) {
      throw new BadRequestException("images array is required");
    }

    const createdImages = await Promise.all(
      images.map((img: any) =>
        this.prisma.taskImage.create({
          data: {
            taskId: taskId,
            imageUrl: img.image_url,
            imageType: img.image_type as TaskImageType,
            caption: img.caption,
            uploadedBy: gardenerId,
          },
        })
      )
    );

    // Auto-send ISSUE images to plant doctor
    const issueImages = images.filter(
      (img: any) => img.image_type === TaskImageType.ISSUE || img.image_type === "ISSUE"
    );
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
  async getTaskImages(userId: string, taskId: string, userRole: UserRole) {
    const task = await this.prisma.maintenanceTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    // Check access (same logic as getTaskById)
    if (userRole === UserRole.GARDENER) {
      const gardener = await this.prisma.gardener.findUnique({
        where: { userId },
      });
      if (!gardener || !task.gardenerId || gardener.id !== task.gardenerId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === UserRole.VENDOR) {
      if (!task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
      const nursery = await this.prisma.nursery.findUnique({
        where: { vendorId: userId },
      });
      if (!nursery || nursery.id !== task.nurseryId) {
        throw new ForbiddenException("Access denied");
      }
    } else if (userRole === UserRole.USER) {
      if (task.userId !== userId) {
        throw new ForbiddenException("Access denied");
      }
    } else {
      throw new ForbiddenException("Access denied");
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

    const dateFilter = this.scheduledDateFilter(date_from, date_to);
    const where: Prisma.MaintenanceTaskWhereInput = {
      nurseryId: nursery.id,
      ...(status && { status }),
      ...(gardener_id && { gardenerId: gardener_id }),
      ...(dateFilter && { scheduledDate: dateFilter }),
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

    await this.notify(
      gardener.userId,
      "New maintenance task",
      `You have a new assigned task ${task.taskNumber} scheduled for ${scheduled_date}.`,
      NotificationType.TASK,
      task.id
    );

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

    const prevGardener = task.gardenerId
      ? await this.prisma.gardener.findUnique({
          where: { id: task.gardenerId },
          select: { userId: true },
        })
      : null;
    const nextGardener = await this.prisma.gardener.findUnique({
      where: { id: gardener_id },
      select: { userId: true },
    });
    if (prevGardener) {
      await this.notify(
        prevGardener.userId,
        "Task reassigned",
        `Task ${updated.taskNumber} was reassigned to another gardener.`,
        NotificationType.TASK,
        taskId
      );
    }
    if (nextGardener) {
      await this.notify(
        nextGardener.userId,
        "New task assigned",
        `You have been assigned task ${updated.taskNumber}.`,
        NotificationType.TASK,
        taskId
      );
    }

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

    const g = task.gardenerId
      ? await this.prisma.gardener.findUnique({
          where: { id: task.gardenerId },
          select: { userId: true },
        })
      : null;
    if (g) {
      await this.notify(
        g.userId,
        "Task rescheduled",
        `Task ${task.taskNumber} schedule was updated by the nursery.`,
        NotificationType.TASK,
        taskId
      );
    }

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
      include: { gardener: { select: { userId: true } } },
    });

    await this.notify(
      task.userId,
      "Maintenance task cancelled",
      `Task ${task.taskNumber} was cancelled by the nursery.${reason ? ` Reason: ${reason}` : ""}`,
      NotificationType.TASK,
      taskId
    );
    if (updated.gardener) {
      await this.notify(
        updated.gardener.userId,
        "Task cancelled",
        `Task ${task.taskNumber} was cancelled by the nursery.`,
        NotificationType.TASK,
        taskId
      );
    }

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

    const dateFilter = this.scheduledDateFilter(date_from, date_to);
    const where: Prisma.MaintenanceTaskWhereInput = {
      userId,
      ...(status && { status }),
      ...(dateFilter && { scheduledDate: dateFilter }),
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

  private parseVisitType(raw: unknown): TaskType {
    if (
      typeof raw === "string" &&
      (Object.values(TaskType) as string[]).includes(raw)
    ) {
      return raw as TaskType;
    }
    return TaskType.SCHEDULED_MAINTENANCE;
  }

  /**
   * POST /api/v1/tasks/vendor/tasks/:task_id/propose-maintenance
   * `task_id` may be a maintenance task id or an order item id (rental line).
   */
  async proposeMaintenanceVisit(vendorUserId: string, idFromRoute: string, body: any) {
    const { proposed_date, proposed_time, visit_type, description } = body ?? {};
    if (!proposed_date) {
      throw new BadRequestException("proposed_date is required");
    }

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId: vendorUserId },
    });
    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const proposedDate = new Date(proposed_date);
    if (Number.isNaN(proposedDate.getTime())) {
      throw new BadRequestException("Invalid proposed_date");
    }
    const taskType = this.parseVisitType(visit_type);

    const existing = await this.prisma.maintenanceTask.findFirst({
      where: { id: idFromRoute, nurseryId: nursery.id },
      include: {
        orderItem: { include: { order: true } },
      },
    });

    if (existing) {
      if (
        existing.status === TaskStatus.COMPLETED ||
        existing.status === TaskStatus.CANCELLED
      ) {
        throw new BadRequestException("Cannot propose on a completed or cancelled task");
      }
      if (existing.proposalStatus === MaintenanceProposalStatus.AWAITING_CUSTOMER) {
        throw new BadRequestException(
          "A proposal is already waiting for the customer. Wait for their response."
        );
      }
      if (existing.proposalStatus === MaintenanceProposalStatus.APPROVED) {
        throw new BadRequestException(
          "This visit was already confirmed. Reschedule or create a new task if needed."
        );
      }

      const updated = await this.prisma.maintenanceTask.update({
        where: { id: existing.id },
        data: {
          vendorProposedDate: proposedDate,
          vendorProposedTime: proposed_time ?? null,
          proposalStatus: MaintenanceProposalStatus.AWAITING_CUSTOMER,
          taskType,
          scheduledDate: proposedDate,
          scheduledTime: proposed_time ?? existing.scheduledTime,
          ...(description !== undefined ? { description } : {}),
        },
        include: {
          orderItem: { include: { plant: true } },
          address: true,
        },
      });

      await this.notify(
        updated.userId,
        "Maintenance visit proposed",
        `The nursery proposed a maintenance visit on ${proposed_date}${proposed_time ? ` at ${proposed_time}` : ""}. Please approve or suggest another time.`,
        NotificationType.TASK,
        updated.id
      );

      return updated;
    }

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: idFromRoute },
      include: { order: true, plant: true },
    });
    if (!orderItem || orderItem.order.nurseryId !== nursery.id) {
      throw new NotFoundException("Task or rental line not found for this nursery");
    }
    if (orderItem.orderType !== "RENT") {
      throw new BadRequestException("Maintenance proposals apply to rental items only");
    }
    if (!["ACTIVE", "EXTENDED"].includes(orderItem.rentalStatus || "")) {
      throw new BadRequestException("Rental must be active to schedule maintenance");
    }

    const address = await this.prisma.userAddress.findFirst({
      where: { userId: orderItem.order.userId, isDefault: true },
    });
    if (!address) {
      throw new NotFoundException("User address not found");
    }

    const created = await this.prisma.maintenanceTask.create({
      data: {
        taskNumber: this.generateTaskNumber(),
        orderItemId: orderItem.id,
        nurseryId: nursery.id,
        gardenerId: null,
        userId: orderItem.order.userId,
        addressId: address.id,
        taskType,
        scheduledDate: proposedDate,
        scheduledTime: proposed_time ?? null,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        description: description ?? null,
        proposalStatus: MaintenanceProposalStatus.AWAITING_CUSTOMER,
        vendorProposedDate: proposedDate,
        vendorProposedTime: proposed_time ?? null,
      },
      include: {
        orderItem: { include: { plant: true } },
        address: true,
      },
    });

    await this.notify(
      created.userId,
      "Maintenance visit proposed",
      `The nursery proposed a maintenance visit on ${proposed_date}${proposed_time ? ` at ${proposed_time}` : ""}. Please approve or suggest another time.`,
      NotificationType.TASK,
      created.id
    );

    return created;
  }

  async customerMaintenanceResponse(userId: string, taskId: string, body: any) {
    const { action, proposed_date, proposed_time } = body ?? {};
    if (action !== "approve" && action !== "reschedule") {
      throw new BadRequestException('action must be "approve" or "reschedule"');
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId },
      include: { nursery: { select: { vendorId: true } } },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    if (task.proposalStatus !== MaintenanceProposalStatus.AWAITING_CUSTOMER) {
      throw new BadRequestException("There is no pending maintenance proposal for this task");
    }

    if (action === "approve") {
      if (!task.vendorProposedDate) {
        throw new BadRequestException("Invalid proposal state");
      }
      const updated = await this.prisma.maintenanceTask.update({
        where: { id: taskId },
        data: {
          proposalStatus: MaintenanceProposalStatus.APPROVED,
          scheduledDate: task.vendorProposedDate,
          scheduledTime: task.vendorProposedTime ?? task.scheduledTime,
          status: task.gardenerId ? TaskStatus.ASSIGNED : TaskStatus.PENDING,
        },
        include: {
          orderItem: { include: { plant: true } },
          gardener: { include: { user: { select: { id: true, fullName: true } } } },
          nursery: { select: { vendorId: true } },
        },
      });

      if (task.nursery?.vendorId) {
        await this.notify(
          task.nursery.vendorId,
          "Maintenance visit confirmed",
          `The customer approved the proposed visit for task ${task.taskNumber}.`,
          NotificationType.TASK,
          taskId
        );
      }
      if (updated.gardener?.userId) {
        await this.notify(
          updated.gardener.userId,
          "Visit confirmed",
          `The customer confirmed the schedule for task ${task.taskNumber}.`,
          NotificationType.TASK,
          taskId
        );
      }
      return updated;
    }

    if (!proposed_date) {
      throw new BadRequestException("proposed_date is required when action is reschedule");
    }
    const counterDate = new Date(proposed_date);
    if (Number.isNaN(counterDate.getTime())) {
      throw new BadRequestException("Invalid proposed_date");
    }

    const updated = await this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        proposalStatus: MaintenanceProposalStatus.RESCHEDULE_REQUESTED,
        customerCounterDate: counterDate,
        customerCounterTime: proposed_time ?? null,
      },
      include: { nursery: { select: { vendorId: true } } },
    });

    if (updated.nursery?.vendorId) {
      await this.notify(
        updated.nursery.vendorId,
        "Customer requested a new time",
        `The customer suggested another time for task ${task.taskNumber}.`,
        NotificationType.TASK,
        taskId
      );
    }

    return updated;
  }

  async submitMaintenanceFeedback(userId: string, taskId: string, body: any) {
    const { rating, comment } = body ?? {};
    if (rating === undefined && comment === undefined) {
      throw new BadRequestException("Provide rating and/or comment");
    }
    if (rating !== undefined) {
      const n = Number(rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new BadRequestException("rating must be an integer from 1 to 5");
      }
    }

    const task = await this.prisma.maintenanceTask.findFirst({
      where: { id: taskId, userId, status: TaskStatus.COMPLETED },
    });
    if (!task) {
      throw new NotFoundException("Completed maintenance task not found");
    }

    return this.prisma.maintenanceTask.update({
      where: { id: taskId },
      data: {
        ...(rating !== undefined ? { maintenanceFeedbackRating: Number(rating) } : {}),
        ...(comment !== undefined ? { maintenanceFeedbackComment: comment } : {}),
      },
    });
  }
}
