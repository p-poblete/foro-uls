from datetime import datetime, timezone
from database import db


def _now():
    return datetime.now(timezone.utc)


# Users
class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.Integer, primary_key=True)
    username     = db.Column(db.String(50),  nullable=False, unique=True)
    email        = db.Column(db.String(255), nullable=False, unique=True)
    display_name = db.Column(db.String(100), nullable=False)
    avatar_url   = db.Column(db.Text)
    bio          = db.Column(db.Text)
    status       = db.Column(db.String(20),  nullable=False, default="active")
    gender       = db.Column(db.String(20))
    career_id    = db.Column(db.Integer, db.ForeignKey("careers.id", ondelete="SET NULL"))
    google_id    = db.Column(db.String(255), unique=True)
    auth_provider = db.Column(db.String(20), default="local")
    created_at   = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
    updated_at   = db.Column(db.DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    deleted_at   = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id":           self.id,
            "username":     self.username,
            "email":        self.email,
            "display_name": self.display_name,
            "avatar_url":   self.avatar_url,
            "bio":          self.bio,
            "status":       self.status,
            "gender":       self.gender,
            "career_id":    self.career_id,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


# Careers (datos de referencia)
class Career(db.Model):
    __tablename__ = "careers"

    id   = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), nullable=False, unique=True)
    name = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {"id": self.id, "code": self.code, "name": self.name}


# Communities
class Community(db.Model):
    __tablename__ = "communities"

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), nullable=False, unique=True)
    slug        = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    owner_id    = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    visibility  = db.Column(db.String(20), nullable=False, default="public")
    status      = db.Column(db.String(20), nullable=False, default="active")
    image_url   = db.Column(db.Text)
    banner_url  = db.Column(db.Text)
    created_at  = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
    updated_at  = db.Column(db.DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    deleted_at  = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id":          self.id,
            "name":        self.name,
            "slug":        self.slug,
            "description": self.description,
            "owner_id":    self.owner_id,
            "visibility":  self.visibility,
            "status":      self.status,
            "image_url":   self.image_url,
            "banner_url":  self.banner_url,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }


# Community members (membresía + aprobación para comunidades restringidas)
class CommunityMember(db.Model):
    __tablename__  = "community_members"
    __table_args__ = (db.UniqueConstraint("community_id", "user_id", name="uq_community_members"),)

    id           = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id",       ondelete="CASCADE"), nullable=False)
    role         = db.Column(db.String(20), nullable=False, default="member")  # member | owner
    status       = db.Column(db.String(20), nullable=False, default="active")  # active | pending
    joined_at    = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    def to_dict(self):
        return {
            "community_id": self.community_id,
            "user_id":      self.user_id,
            "role":         self.role,
            "status":       self.status,
            "joined_at":    self.joined_at.isoformat() if self.joined_at else None,
        }


# Posts
class Post(db.Model):
    __tablename__ = "posts"

    id           = db.Column(db.Integer, primary_key=True)
    community_id = db.Column(db.Integer, db.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    author_id    = db.Column(db.Integer, db.ForeignKey("users.id",       ondelete="SET NULL"))
    title        = db.Column(db.String(300), nullable=False)
    content      = db.Column(db.Text)
    image_url    = db.Column(db.Text)
    external_link = db.Column(db.Text)
    label        = db.Column(db.String(20))
    post_type    = db.Column(db.String(20),  nullable=False, default="text")
    vote_score   = db.Column(db.Integer,     nullable=False, default=0)
    status       = db.Column(db.String(20),  nullable=False, default="active")
    created_at   = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
    updated_at   = db.Column(db.DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    deleted_at   = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id":           self.id,
            "community_id": self.community_id,
            "author_id":    self.author_id,
            "title":        self.title,
            "content":      self.content,
            "image_url":    self.image_url,
            "external_link": self.external_link,
            "label":        self.label,
            "post_type":    self.post_type,
            "vote_score":   self.vote_score,
            "status":       self.status,
            "created_at":   self.created_at.isoformat() if self.created_at else None,
        }


# Post Votes (avoids duplicates with unique constraint)
class PostVote(db.Model):
    __tablename__  = "post_votes"
    __table_args__ = (db.UniqueConstraint("post_id", "user_id", name="uq_post_votes"),)

    id         = db.Column(db.Integer,   primary_key=True)
    post_id    = db.Column(db.Integer,   db.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id    = db.Column(db.Integer,   db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote_type  = db.Column(db.SmallInteger, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)
