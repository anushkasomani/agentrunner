use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod agent_registry {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.total_agents = 0;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        description: String,
        version: String,
        skills: Vec<String>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let registry = &mut ctx.accounts.registry;

        agent.id = registry.total_agents;
        agent.name = name;
        agent.description = description;
        agent.version = version;
        agent.skills = skills;
        agent.owner = ctx.accounts.authority.key();
        agent.created_at = Clock::get()?.unix_timestamp;
        agent.is_active = true;
        agent.bump = ctx.bumps.agent;

        registry.total_agents += 1;

        emit!(AgentRegistered {
            agent_id: agent.id,
            owner: agent.owner,
            name: agent.name.clone(),
        });

        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        description: Option<String>,
        version: Option<String>,
        skills: Option<Vec<String>>,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent;

        if let Some(name) = name {
            agent.name = name;
        }
        if let Some(description) = description {
            agent.description = description;
        }
        if let Some(version) = version {
            agent.version = version;
        }
        if let Some(skills) = skills {
            agent.skills = skills;
        }

        agent.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentUpdated {
            agent_id: agent.id,
            owner: agent.owner,
        });

        Ok(())
    }

    pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.is_active = false;
        agent.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentDeactivated {
            agent_id: agent.id,
            owner: agent.owner,
        });

        Ok(())
    }

    pub fn anchor_merkle_root(
        ctx: Context<AnchorMerkleRoot>,
        plan_id: String,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        let merkle_account = &mut ctx.accounts.merkle_account;
        
        merkle_account.plan_id = plan_id;
        merkle_account.root = merkle_root;
        merkle_account.anchored_at = Clock::get()?.unix_timestamp;
        merkle_account.authority = ctx.accounts.authority.key();
        merkle_account.bump = ctx.bumps.merkle_account;

        emit!(MerkleRootAnchored {
            plan_id: merkle_account.plan_id.clone(),
            root: merkle_account.root,
            authority: merkle_account.authority,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Registry::INIT_SPACE,
        seeds = [b"registry"],
        bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", registry.total_agents.to_le_bytes().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(
        mut,
        seeds = [b"registry"],
        bump = registry.bump
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.id.to_le_bytes().as_ref()],
        bump = agent.bump,
        constraint = agent.owner == authority.key()
    )]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateAgent<'info> {
    #[account(
        mut,
        seeds = [b"agent", agent.id.to_le_bytes().as_ref()],
        bump = agent.bump,
        constraint = agent.owner == authority.key()
    )]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(plan_id: String)]
pub struct AnchorMerkleRoot<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MerkleAccount::INIT_SPACE,
        seeds = [b"merkle", plan_id.as_bytes()],
        bump
    )]
    pub merkle_account: Account<'info, MerkleAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub authority: Pubkey,
    pub total_agents: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub id: u64,
    pub name: String,
    pub description: String,
    pub version: String,
    pub skills: Vec<String>,
    pub owner: Pubkey,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MerkleAccount {
    pub plan_id: String,
    pub root: [u8; 32],
    pub anchored_at: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[event]
pub struct AgentRegistered {
    pub agent_id: u64,
    pub owner: Pubkey,
    pub name: String,
}

#[event]
pub struct AgentUpdated {
    pub agent_id: u64,
    pub owner: Pubkey,
}

#[event]
pub struct AgentDeactivated {
    pub agent_id: u64,
    pub owner: Pubkey,
}

#[event]
pub struct MerkleRootAnchored {
    pub plan_id: String,
    pub root: [u8; 32],
    pub authority: Pubkey,
}
