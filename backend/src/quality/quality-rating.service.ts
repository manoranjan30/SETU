import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QualityRatingConfig } from './entities/quality-rating-config.entity';
import { ProjectRating } from './entities/quality-project-rating.entity';
import { SiteObservation } from './entities/site-observation.entity';

@Injectable()
export class QualityRatingService {
    constructor(
        @InjectRepository(QualityRatingConfig)
        private configRepo: Repository<QualityRatingConfig>,
        @InjectRepository(ProjectRating)
        private ratingRepo: Repository<ProjectRating>,
        @InjectRepository(SiteObservation)
        private observationRepo: Repository<SiteObservation>,
    ) { }

    async getConfig(projectId: number): Promise<QualityRatingConfig> {
        let config = await this.configRepo.findOne({ where: { projectNodeId: projectId } });
        if (!config) {
            // Create default config for project
            config = this.configRepo.create({ projectNodeId: projectId });
            await this.configRepo.save(config);
        }
        return config;
    }

    async updateConfig(projectId: number, update: Partial<QualityRatingConfig>): Promise<QualityRatingConfig> {
        const config = await this.getConfig(projectId);
        Object.assign(config, update);
        return this.configRepo.save(config);
    }

    async calculateProjectRating(projectId: number, projectStatus: string): Promise<any> {
        const config = await this.getConfig(projectId);
        const observations = await this.observationRepo.find({ where: { projectId: projectId } });

        if (observations.length === 0) {
            return {
                overallScore: 10, // Max score if no observations? Or 0? Usually 10 if no defects.
                observationScore: 5,
                details: 'No observations recorded yet.'
            };
        }

        // 1. Calculate weighted observation score
        let totalSeverityPoints = 0;
        let closedObservationsCount = 0;

        // We only rate CLOSED observations for their quality, or all of them? 
        // Usually, the "Observation Rating" from the doc (5,4,3,2,1) refers to the quality of the item found.
        // If it's a "Critical" defect (1 point), it pulls the average down.

        observations.forEach(obs => {
            const points = config.severityRatings[obs.severity] || 5;
            totalSeverityPoints += points;
            if (obs.status === 'CLOSED') {
                closedObservationsCount++;
            }
        });

        const averageObservationScore = totalSeverityPoints / observations.length; // Out of 5

        // 2. Pending Deduction
        const totalCount = observations.length;
        const openCount = totalCount - closedObservationsCount;
        const pendingRatio = (openCount / totalCount) * 100;

        let deductionPoints = 0;
        for (const rule of config.deductionRules) {
            if (pendingRatio >= rule.min && pendingRatio <= rule.max) {
                deductionPoints = rule.points;
                break;
            }
        }

        // 3. Final Overall Rating (out of 10)
        // Based on "Rating Summary" table: 
        // Status Weightage (e.g. Structure: Observation=5, Doc=5)
        const contextWeights = config.categoryWeights.find(w => w.status === projectStatus) || config.categoryWeights[0];

        // For now, assume Documentation and Customer Inspections are at max score (placeholder)
        const documentationScore = 5;
        const customerInspectionScore = 5;

        const weightedObservationScore = (contextWeights.observations / 5) * averageObservationScore;
        const weightedDocScore = (contextWeights.documentation / 5) * documentationScore;
        const weightedCustScore = (contextWeights.customerInspections / 5) * customerInspectionScore;

        const overallScore = (weightedObservationScore + weightedDocScore + weightedCustScore) - deductionPoints;

        return {
            overallScore: Math.max(0, parseFloat(overallScore.toFixed(2))),
            observationScore: parseFloat(averageObservationScore.toFixed(2)),
            pendingDeduction: deductionPoints,
            totalObservations: totalCount,
            openObservations: openCount,
            pendingRatioPercentage: parseFloat(pendingRatio.toFixed(1)),
            documentationScore,
            customerInspectionScore,
            context: projectStatus
        };
    }

    async saveMonthlyRating(projectId: number, projectStatus: string): Promise<ProjectRating> {
        const result = await this.calculateProjectRating(projectId, projectStatus);
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM

        let rating = await this.ratingRepo.findOne({ where: { projectNodeId: projectId, period } });
        if (!rating) {
            rating = this.ratingRepo.create({
                projectNodeId: projectId,
                period,
            });
        }

        Object.assign(rating, {
            overallScore: result.overallScore,
            observationScore: result.observationScore,
            documentationScore: result.documentationScore,
            customerInspectionScore: result.customerInspectionScore,
            pendingDeduction: result.pendingDeduction,
            totalObservations: result.totalObservations,
            openObservations: result.openObservations,
            pendingRatioPercentage: result.pendingRatioPercentage,
            details: result
        });

        return this.ratingRepo.save(rating);
    }

    async getRatingHistory(projectId: number): Promise<ProjectRating[]> {
        return this.ratingRepo.find({
            where: { projectNodeId: projectId },
            order: { period: 'DESC' }
        });
    }
}
