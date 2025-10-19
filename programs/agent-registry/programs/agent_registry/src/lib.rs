use anchor_lang::prelude::*;

declare_id!("AGentReg1strY111111111111111111111111111111"); // REPLACE with your deployed AGENT_PROGRAM_ID

#[program]
pub mod agent_registry {
    use super::*;

    /// Create an Agent record bound to an identity pubkey, owned by `owner`.
    pub fn register_agent(ctx: Context<RegisterAgent>, identity: Pubkey, metadata_uri: String) -> Result<()> {
        require!(metadata_uri.as_bytes().len() <= 200, RegistryError::MetadataTooLong);

        let agent = &mut ctx.accounts.agent;
        agent.identity = identity;
        agent.owner = ctx.accounts.owner.key();
        agent.metadata_uri = metadata_uri;
        agent.bump = *ctx.bumps.get("agent").unwrap();
        agent.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Update the agent's metadata (only the owner).
    pub fn update_agent(ctx: Context<UpdateAgent>, metadata_uri: String) -> Result<()> {
        require!(metadata_uri.as_bytes().len() <= 200, RegistryError::MetadataTooLong);
        require_keys_eq!(ctx.accounts.owner.key(), ctx.accounts.agent.owner, RegistryError::Unauthorized);
        ctx.accounts.agent.metadata_uri = metadata_uri;
        Ok(())
    }

    /// Post a daily validation (e.g., Merkle root of receipts). Any signer can validate; trust is off-chain.
    pub fn post_validation(ctx: Context<PostValidation>, day_yyyymmdd: u32, merkle_root: [u8; 32]) -> Result<()> {
        let v = &mut ctx.accounts.validation;
        v.identity = ctx.accounts.agent.identity;
        v.validator = ctx.accounts.validator.key();
        v.day_yyyymmdd = day_yyyymmdd;
        v.merkle_root = merkle_root;
        v.bump = *ctx.bumps.get("validation").unwrap();
        v.ts = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Create or update feedback (rating 0-100, optional tag bucket). One per (reviewer, identity).
    pub fn post_feedback(ctx: Context<PostFeedback>, rating: u8, tag: u8) -> Result<()> {
        require!(rating <= 100, RegistryError::BadRating);
        let f = &mut ctx.accounts.feedback;
        f.identity = ctx.accounts.agent.identity;
        f.reviewer = ctx.accounts.reviewer.key();
        f.rating = rating;
        f.tag = tag;
        f.bump = *ctx.bumps.get("feedback").unwrap();
        f.ts = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(identity: Pubkey)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Agent::SIZE,
        seeds = [b"agent", identity.as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent: Account<'info, Agent>,
}

#[derive(Accounts)]
#[instruction(day_yyyymmdd: u32)]
pub struct PostValidation<'info> {
    /// Validator posting the root (could be the runner or an external auditor)
    pub validator: Signer<'info>,

    /// Ensure the agent exists
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = validator,
        space = 8 + Validation::SIZE,
        seeds = [b"validation", agent.identity.as_ref(), &day_yyyymmdd.to_le_bytes()],
        bump
    )]
    pub validation: Account<'info, Validation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PostFeedback<'info> {
    pub reviewer: Signer<'info>,
    pub agent: Account<'info, Agent>,

    #[account(
        init_if_needed,
        payer = reviewer,
        space = 8 + Feedback::SIZE,
        seeds = [b"feedback", agent.identity.as_ref(), reviewer.key.as_ref()],
        bump
    )]
    pub feedback: Account<'info, Feedback>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Agent {
    pub identity: Pubkey,
    pub owner: Pubkey,
    pub metadata_uri: String,
    pub bump: u8,
    pub created_at: i64,
}
impl Agent {
    // 32 + 32 + (4 + 200) + 1 + 8
    pub const SIZE: usize = 32 + 32 + 4 + 200 + 1 + 8;
}

#[account]
pub struct Validation {
    pub identity: Pubkey,
    pub validator: Pubkey,
    pub day_yyyymmdd: u32,
    pub merkle_root: [u8; 32],
    pub bump: u8,
    pub ts: i64,
}
impl Validation {
    // 32 + 32 + 4 + 32 + 1 + 8
    pub const SIZE: usize = 32 + 32 + 4 + 32 + 1 + 8;
}

#[account]
pub struct Feedback {
    pub identity: Pubkey,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub tag: u8,
    pub bump: u8,
    pub ts: i64,
}
impl Feedback {
    // 32 + 32 + 1 + 1 + 1 + 8
    pub const SIZE: usize = 32 + 32 + 1 + 1 + 1 + 8;
}

#[error_code]
pub enum RegistryError {
    #[msg("metadata uri too long")]
    MetadataTooLong,
    #[msg("unauthorized")]
    Unauthorized,
    #[msg("rating must be 0..=100")]
    BadRating,
}
