from flask import Blueprint, jsonify
from models import Career

careers_bp = Blueprint("careers", __name__)


@careers_bp.route("/careers", methods=["GET"])
def get_careers():
    careers = Career.query.order_by(Career.name).all()
    return jsonify({"careers": [c.to_dict() for c in careers]})
