import { bootstrap } from "shared/framework";
import { AbyssService } from "./services/AbyssService";
import { AquariumService } from "./services/AquariumService";
import { CoinService } from "./services/CoinService";
import { CompanionService } from "./services/CompanionService";
import { DataService } from "./services/DataService";
import { DevCommandService } from "./services/DevCommandService";
import { EggService } from "./services/EggService";
import { EventService } from "./services/EventService";
import { FishService } from "./services/FishService";
import { FoodService } from "./services/FoodService";
import { InteractionService } from "./services/InteractionService";
import { LikeService } from "./services/LikeService";
import { OnboardingService } from "./services/OnboardingService";
import { OceanService } from "./services/OceanService";
import { QuestService } from "./services/QuestService";
import { RebirthService } from "./services/RebirthService";

// Register all server services here
bootstrap([
	DataService,
	InteractionService,
	AquariumService,
	FoodService,
	CoinService,
	FishService,
	EggService,
	OnboardingService,
	AbyssService,
	EventService,
	CompanionService,
	QuestService,
	OceanService,
	LikeService,
	RebirthService,
	DevCommandService,
]);
